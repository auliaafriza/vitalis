-- ============================================================================
-- Calorya — entitlements (free / premium) and the history window
--
-- The paywall is enforced HERE, not in React. A free user who calls PostgREST
-- directly gets the same 7-day window the UI shows them; the client is only
-- responsible for explaining the limit, never for imposing it.
-- ============================================================================

create type public.plan_tier as enum ('free', 'premium');

-- ---------------------------------------------------------------------------
-- subscriptions — one row per user, written by the billing webhook
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  tier               public.plan_tier not null default 'free',
  -- 'active' | 'trialing' | 'past_due' | 'canceled'
  status             text not null default 'active',
  current_period_end timestamptz,
  -- 'stripe' | 'midtrans' | 'xendit' | 'revenuecat' | null while free
  provider           text,
  provider_ref       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger subscriptions_touch
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

alter table public.subscriptions enable row level security;

-- Readable by its owner; deliberately NOT writable by them. Upgrades arrive
-- through a webhook using the service role, so a user cannot promote himself.
create policy "subscriptions: read own" on public.subscriptions for select
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- The two functions everything else is built on
-- ---------------------------------------------------------------------------

/**
 * The caller's effective tier.
 * A subscription that has lapsed (past_due, canceled, or simply expired)
 * falls back to free without anyone having to run a cleanup job.
 */
create or replace function public.current_tier()
returns public.plan_tier
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.tier
       from public.subscriptions s
      where s.user_id = (select auth.uid())
        and s.status in ('active', 'trialing')
        and (s.current_period_end is null or s.current_period_end > now())
      limit 1),
    'free'::public.plan_tier)
$$;

/**
 * The oldest date the caller may read.
 *
 * Free gets `current_date - 7`, one day wider than the 7 days the UI offers.
 * `current_date` is the server's date while `logged_on` is the user's local
 * date, so a user in UTC+7 logging at 23:00 would otherwise briefly lose their
 * oldest visible day to that skew. The extra day is invisible slack, not a
 * feature — the UI still stops at 7.
 *
 * STABLE, so the planner evaluates it once per query rather than per row.
 */
create or replace function public.history_floor()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_tier()
           when 'premium' then date '1900-01-01'
           else current_date - 7
         end
$$;

grant execute on function public.current_tier() to authenticated;
grant execute on function public.history_floor() to authenticated;

-- ---------------------------------------------------------------------------
-- Apply the window to every table that carries history
--
-- targets, profiles and foods are deliberately NOT windowed: a target is
-- needed to score any day, and hiding the food catalogue would break logging
-- rather than gate history.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'food_entries', 'water_entries', 'sleep_entries',
    'step_entries', 'mood_entries', 'weight_entries'
  ]
  loop
    execute format('drop policy if exists "%1$s: read own" on public.%1$I', t);
    execute format($f$
      create policy "%1$s: read own" on public.%1$I for select
        using (
          (select auth.uid()) = user_id
          and logged_on >= public.history_floor()
        );
    $f$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Every new user starts on free
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.targets (user_id, kcal, protein_g, carbs_g, fat_g)
  values (new.id, 2000, 120, 220, 65)
  on conflict (user_id, effective_from) do nothing;

  insert into public.subscriptions (user_id, tier, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Existing accounts predate this table; give them a free row too.
insert into public.subscriptions (user_id, tier, status)
select id, 'free', 'active' from auth.users
on conflict (user_id) do nothing;
