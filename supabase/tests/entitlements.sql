-- ============================================================================
-- Behavioural tests for the free / premium history window.
--
-- The claim being tested is the one that actually matters commercially: a free
-- user cannot reach older history by ANY route, including calling PostgREST
-- directly. If this suite passes, the paywall is a property of the database,
-- not a property of the React code.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/entitlements.sql
--
-- The product currently ships with the paywall switched OFF (see
-- 20260908000000_paywall_switch.sql), so this suite turns it on for the
-- duration of its transaction. That is the point of the two files: this one
-- proves the gate still works, paywall_switch.sql proves the switch opens it.
-- ============================================================================

begin;

update public.app_settings set paywall_enabled = true;

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'free@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'premium@example.com');

do $$
declare
  free_id  uuid := '33333333-3333-3333-3333-333333333333';
  prem_id  uuid := '44444444-4444-4444-4444-444444444444';
  nasi_id  uuid;
  visible  int;
  cur_tier public.plan_tier;
begin
  select id into nasi_id from public.foods where name = 'Nasi putih';

  -- Fixtures written as the owner (bypassing RLS is fine for setup).
  insert into public.food_entries (user_id, food_id, logged_on, meal, quantity_g) values
    (free_id, nasi_id, current_date,       'lunch', 150),
    (free_id, nasi_id, current_date - 3,   'lunch', 150),
    (free_id, nasi_id, current_date - 30,  'lunch', 150),
    (free_id, nasi_id, current_date - 200, 'lunch', 150),
    (prem_id, nasi_id, current_date,       'lunch', 150),
    (prem_id, nasi_id, current_date - 200, 'lunch', 150);

  insert into public.weight_entries (user_id, logged_on, weight_kg) values
    (free_id, current_date, 70), (free_id, current_date - 90, 75);

  -- ------------------------------------------------------------------
  -- 1. Every new user is provisioned on free
  -- ------------------------------------------------------------------
  select count(*) into visible from public.subscriptions
   where user_id in (free_id, prem_id) and tier = 'free';
  if visible <> 2 then
    raise exception 'FAIL: new users were not provisioned on free (got %)', visible;
  end if;
  raise notice 'PASS: handle_new_user provisions a free subscription';

  -- ------------------------------------------------------------------
  -- 2. A free user sees recent days but not older history
  -- ------------------------------------------------------------------
  set local role authenticated;
  set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

  select public.current_tier() into cur_tier;
  if cur_tier <> 'free' then
    raise exception 'FAIL: default tier is %, expected free', cur_tier;
  end if;

  select count(*) into visible from public.food_entries;
  if visible <> 2 then
    raise exception 'FAIL: free user sees % food entries, expected 2 (today + 3 days ago)', visible;
  end if;
  raise notice 'PASS: free user reads only the recent window (% rows)', visible;

  -- Asking for the old row explicitly must not smuggle it out either.
  select count(*) into visible from public.food_entries
   where logged_on = current_date - 30;
  if visible <> 0 then
    raise exception 'FAIL: an explicit query reached a row outside the window';
  end if;
  raise notice 'PASS: querying the old date directly still returns nothing';

  -- ------------------------------------------------------------------
  -- 3. The window applies to every history table, and to the view
  -- ------------------------------------------------------------------
  select count(*) into visible from public.weight_entries;
  if visible <> 1 then
    raise exception 'FAIL: free user sees % weight entries, expected 1', visible;
  end if;

  select count(*) into visible from public.daily_summary
   where logged_on < current_date - 8;
  if visible <> 0 then
    raise exception 'FAIL: the daily_summary view leaks % old rows', visible;
  end if;
  raise notice 'PASS: window covers weight_entries and the daily_summary view';

  -- ------------------------------------------------------------------
  -- 4. A user cannot promote himself
  -- ------------------------------------------------------------------
  begin
    update public.subscriptions set tier = 'premium' where user_id = free_id;
    if found then
      raise exception 'FAIL: a user upgraded their own subscription';
    end if;
    raise notice 'PASS: self-upgrade updates no rows (no UPDATE policy)';
  exception
    when insufficient_privilege then
      raise notice 'PASS: self-upgrade is rejected outright';
  end;

  begin
    insert into public.subscriptions (user_id, tier) values (free_id, 'premium');
    raise exception 'FAIL: a user inserted their own premium subscription';
  exception
    when insufficient_privilege or unique_violation then
      raise notice 'PASS: inserting a subscription row is rejected';
  end;

  -- ------------------------------------------------------------------
  -- 5. Premium sees everything
  -- ------------------------------------------------------------------
  set local role postgres;                       -- the billing webhook's role
  update public.subscriptions
     set tier = 'premium', status = 'active',
         current_period_end = now() + interval '30 days'
   where user_id = prem_id;

  set local role authenticated;
  set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

  select public.current_tier() into cur_tier;
  if cur_tier <> 'premium' then
    raise exception 'FAIL: upgraded user reads as %', cur_tier;
  end if;

  select count(*) into visible from public.food_entries;
  if visible <> 2 then
    raise exception 'FAIL: premium user sees % entries, expected 2 including the 200-day-old one', visible;
  end if;
  raise notice 'PASS: premium reads the full history';

  -- ------------------------------------------------------------------
  -- 6. A lapsed subscription silently falls back to free
  -- ------------------------------------------------------------------
  set local role postgres;
  update public.subscriptions
     set current_period_end = now() - interval '1 day'
   where user_id = prem_id;

  set local role authenticated;
  select public.current_tier() into cur_tier;
  if cur_tier <> 'free' then
    raise exception 'FAIL: expired subscription still reads as %', cur_tier;
  end if;

  select count(*) into visible from public.food_entries;
  if visible <> 1 then
    raise exception 'FAIL: expired user sees % entries, expected 1', visible;
  end if;
  raise notice 'PASS: an expired subscription reverts to the free window';

  set local role postgres;
  update public.subscriptions set status = 'canceled', current_period_end = null
   where user_id = prem_id;
  set local role authenticated;
  select public.current_tier() into cur_tier;
  if cur_tier <> 'free' then
    raise exception 'FAIL: canceled subscription still reads as %', cur_tier;
  end if;
  raise notice 'PASS: a canceled subscription reverts to the free window';

  -- ------------------------------------------------------------------
  -- 7. The window must never block logging today
  -- ------------------------------------------------------------------
  insert into public.water_entries (user_id, logged_on, amount_ml)
  values (prem_id, current_date, 250);
  select count(*) into visible from public.water_entries where logged_on = current_date;
  if visible <> 1 then
    raise exception 'FAIL: a free user cannot read back what they just logged today';
  end if;
  raise notice 'PASS: today stays readable and writable on the free tier';

  raise notice '--- all entitlement tests passed ---';
end;
$$;

rollback;
