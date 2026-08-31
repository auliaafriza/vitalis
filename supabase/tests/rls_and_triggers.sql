-- ============================================================================
-- Behavioural tests for the schema.
--
-- These are the assertions that matter and that TypeScript cannot make:
--   1. One user can never read or write another user's health data.
--   2. Editing a food does not rewrite already-logged entries.
--   3. The daily rollup view adds up correctly.
--
-- Run against a database with the migrations applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_and_triggers.sql
-- Any failure raises an exception and aborts.
-- ============================================================================

begin;

-- --- fixtures ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

-- The handle_new_user trigger has created a profile and default targets for each.

-- Act as Alice.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  nasi_id uuid;
  entry_id uuid;
  logged_kcal numeric;
  visible int;
begin
  -- ------------------------------------------------------------------
  -- 1. The snapshot trigger computes nutrition from quantity
  -- ------------------------------------------------------------------
  select id into nasi_id from public.foods where name = 'Nasi putih';
  if nasi_id is null then
    raise exception 'FAIL: seed catalogue is not visible to an authenticated user';
  end if;

  insert into public.food_entries (user_id, food_id, logged_on, meal, quantity_g)
  values (auth.uid(), nasi_id, date '2026-08-31', 'lunch', 150)
  returning id, kcal into entry_id, logged_kcal;

  -- 130 kcal per 100 g x 1.5 = 195
  if logged_kcal <> 195.00 then
    raise exception 'FAIL: snapshot trigger computed % kcal, expected 195', logged_kcal;
  end if;
  raise notice 'PASS: snapshot trigger computes portion nutrition (% kcal)', logged_kcal;

  -- ------------------------------------------------------------------
  -- 2. Editing the food must NOT rewrite history
  -- ------------------------------------------------------------------
  set local role postgres;
  update public.foods set kcal = 999 where id = nasi_id;
  set local role authenticated;

  select kcal into logged_kcal from public.food_entries where id = entry_id;
  if logged_kcal <> 195.00 then
    raise exception 'FAIL: history changed to % kcal after the food was edited', logged_kcal;
  end if;
  raise notice 'PASS: editing a food leaves already-logged entries untouched';

  -- restore
  set local role postgres;
  update public.foods set kcal = 130 where id = nasi_id;
  set local role authenticated;

  -- ------------------------------------------------------------------
  -- 3. Changing the quantity re-runs the snapshot
  -- ------------------------------------------------------------------
  update public.food_entries set quantity_g = 300 where id = entry_id;
  select kcal into logged_kcal from public.food_entries where id = entry_id;
  if logged_kcal <> 390.00 then
    raise exception 'FAIL: re-snapshot gave % kcal, expected 390', logged_kcal;
  end if;
  raise notice 'PASS: changing the portion re-computes the snapshot';

  -- ------------------------------------------------------------------
  -- 4. The daily rollup view sums the day
  -- ------------------------------------------------------------------
  insert into public.water_entries (user_id, logged_on, amount_ml)
  values (auth.uid(), date '2026-08-31', 500), (auth.uid(), date '2026-08-31', 350);

  insert into public.sleep_entries (user_id, logged_on, duration_min, quality)
  values (auth.uid(), date '2026-08-31', 450, 4);

  perform 1 from public.daily_summary
   where logged_on = date '2026-08-31'
     and kcal = 390
     and water_ml = 850
     and sleep_min = 450;
  if not found then
    raise exception 'FAIL: daily_summary did not roll the day up correctly';
  end if;
  raise notice 'PASS: daily_summary rolls up nutrition, water and sleep';

  -- ------------------------------------------------------------------
  -- 5. RLS: Bob must see nothing of Alice's
  -- ------------------------------------------------------------------
  set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

  select count(*) into visible from public.food_entries;
  if visible <> 0 then
    raise exception 'FAIL: another user can read % food entries', visible;
  end if;

  select count(*) into visible from public.water_entries;
  if visible <> 0 then
    raise exception 'FAIL: another user can read % water entries', visible;
  end if;

  select count(*) into visible from public.daily_summary;
  if visible <> 0 then
    raise exception 'FAIL: the summary view leaks % rows across users', visible;
  end if;

  select count(*) into visible from public.profiles;
  if visible <> 1 then
    raise exception 'FAIL: a user can see % profiles, expected only their own', visible;
  end if;
  raise notice 'PASS: RLS isolates every user-owned table and the summary view';

  -- ------------------------------------------------------------------
  -- 6. RLS: Bob must not be able to write data attributed to Alice
  -- ------------------------------------------------------------------
  begin
    insert into public.water_entries (user_id, logged_on, amount_ml)
    values ('11111111-1111-1111-1111-111111111111', date '2026-08-31', 250);
    raise exception 'FAIL: a user was able to insert a row owned by someone else';
  exception
    when insufficient_privilege then
      raise notice 'PASS: cross-user insert is rejected by the WITH CHECK policy';
  end;

  -- ------------------------------------------------------------------
  -- 7. RLS: Bob cannot delete Alice's row (it simply is not there to delete)
  -- ------------------------------------------------------------------
  delete from public.food_entries where id = entry_id;
  if found then
    raise exception 'FAIL: a user deleted another user''s entry';
  end if;
  raise notice 'PASS: cross-user delete affects no rows';

  -- ------------------------------------------------------------------
  -- 8. Private foods stay private
  -- ------------------------------------------------------------------
  insert into public.foods (name, kcal, created_by, is_public)
  values ('Resep rahasia Bob', 250, auth.uid(), false);

  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
  select count(*) into visible from public.foods where name = 'Resep rahasia Bob';
  if visible <> 0 then
    raise exception 'FAIL: a private food is visible to another user';
  end if;
  raise notice 'PASS: private foods are visible only to their author';

  -- ------------------------------------------------------------------
  -- 9. Constraints hold
  -- ------------------------------------------------------------------
  begin
    insert into public.water_entries (user_id, logged_on, amount_ml)
    values (auth.uid(), date '2026-08-31', -100);
    raise exception 'FAIL: a negative water amount was accepted';
  exception
    when check_violation then
      raise notice 'PASS: check constraints reject impossible values';
  end;

  raise notice '--- all schema behaviour tests passed ---';
end;
$$;

rollback;
