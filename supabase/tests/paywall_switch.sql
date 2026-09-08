-- ============================================================================
-- Behavioural tests for the paywall switch.
--
-- Two claims are being tested, and they pull in opposite directions:
--   1. With the switch off, nothing is gated — a plain free account reads its
--      whole history, because that is what "premium untuk semua" has to mean.
--   2. The switch is not reachable by the people it governs. A user who could
--      flip it would have found a free upgrade for the entire product.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/paywall_switch.sql
-- ============================================================================

begin;

insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'switch@example.com');

do $$
declare
  uid      uuid := '55555555-5555-5555-5555-555555555555';
  nasi_id  uuid;
  visible  int;
  cur_tier public.plan_tier;
  floor_at date;
begin
  select id into nasi_id from public.foods where name = 'Nasi putih';

  insert into public.food_entries (user_id, food_id, logged_on, meal, quantity_g) values
    (uid, nasi_id, current_date,       'lunch', 150),
    (uid, nasi_id, current_date - 3,   'lunch', 150),
    (uid, nasi_id, current_date - 30,  'lunch', 150),
    (uid, nasi_id, current_date - 400, 'lunch', 150);

  -- ------------------------------------------------------------------
  -- 1. The shipped default is "open"
  -- ------------------------------------------------------------------
  if public.paywall_enabled() then
    raise exception 'FAIL: the migration shipped with the paywall enabled';
  end if;
  raise notice 'PASS: the paywall ships switched off';

  -- ------------------------------------------------------------------
  -- 2. With the switch off a free account reads as premium…
  -- ------------------------------------------------------------------
  set local role authenticated;
  set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

  select public.current_tier() into cur_tier;
  if cur_tier <> 'premium' then
    raise exception 'FAIL: with the paywall off the tier reads %, expected premium', cur_tier;
  end if;
  raise notice 'PASS: every signed-in user reads as premium while the switch is off';

  -- …and the subscription row still honestly says 'free'. The row records
  -- what someone has paid for; current_tier() records what they may do. They
  -- are deliberately not the same thing.
  select count(*) into visible from public.subscriptions
   where user_id = uid and tier = 'free';
  if visible <> 1 then
    raise exception 'FAIL: the switch rewrote the subscription row';
  end if;
  raise notice 'PASS: the switch grants access without faking a subscription';

  -- ------------------------------------------------------------------
  -- 3. …so the history window is wide open
  -- ------------------------------------------------------------------
  select public.history_floor() into floor_at;
  if floor_at > date '1900-01-01' then
    raise exception 'FAIL: history floor is % with the paywall off', floor_at;
  end if;

  select count(*) into visible from public.food_entries;
  if visible <> 4 then
    raise exception 'FAIL: sees % entries with the paywall off, expected all 4', visible;
  end if;

  select count(*) into visible from public.food_entries
   where logged_on = current_date - 400;
  if visible <> 1 then
    raise exception 'FAIL: the 400-day-old row is still hidden';
  end if;
  raise notice 'PASS: all history is readable, including a 400-day-old row';

  -- ------------------------------------------------------------------
  -- 4. A user cannot turn the paywall on or off
  -- ------------------------------------------------------------------
  begin
    update public.app_settings set paywall_enabled = true;
    if found then
      raise exception 'FAIL: a user changed the paywall setting';
    end if;
    raise notice 'PASS: writing app_settings updates no rows (no UPDATE policy)';
  exception
    when insufficient_privilege then
      raise notice 'PASS: writing app_settings is rejected outright';
  end;

  begin
    insert into public.app_settings (id, paywall_enabled) values (true, true);
    raise exception 'FAIL: a user inserted a second settings row';
  exception
    when insufficient_privilege or unique_violation or check_violation then
      raise notice 'PASS: inserting an app_settings row is rejected';
  end;

  -- ------------------------------------------------------------------
  -- 5. Turning it on restores the gate — nothing was deleted, only held open
  -- ------------------------------------------------------------------
  set local role postgres;
  update public.app_settings set paywall_enabled = true;

  set local role authenticated;
  select public.current_tier() into cur_tier;
  if cur_tier <> 'free' then
    raise exception 'FAIL: with the paywall back on the tier reads %', cur_tier;
  end if;

  select count(*) into visible from public.food_entries;
  if visible <> 2 then
    raise exception 'FAIL: sees % entries with the paywall on, expected 2', visible;
  end if;
  raise notice 'PASS: switching the paywall back on restores the 7-day window';

  -- ------------------------------------------------------------------
  -- 6. A missing settings row fails OPEN, not closed
  --
  -- The safe direction here is the opposite of everywhere else in this file:
  -- losing the settings row must not lock every paying user out of their own
  -- history.
  -- ------------------------------------------------------------------
  set local role postgres;
  delete from public.app_settings;

  set local role authenticated;
  if public.paywall_enabled() then
    raise exception 'FAIL: a missing settings row enabled the paywall';
  end if;

  select count(*) into visible from public.food_entries;
  if visible <> 4 then
    raise exception 'FAIL: a missing settings row hid % of the history', 4 - visible;
  end if;
  raise notice 'PASS: a missing settings row leaves the product open';

  raise notice '--- all paywall switch tests passed ---';
end;
$$;

rollback;
