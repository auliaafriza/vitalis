-- ============================================================================
-- Calorya — the paywall switch
--
-- The entitlement machinery from 20260907000000 stays exactly as it is:
-- subscriptions, current_tier(), history_floor(), and the RLS policies that
-- read them. What this migration adds is a single flag that decides whether
-- any of it restricts anybody.
--
-- With paywall_enabled = false (the value shipped here) current_tier() answers
-- 'premium' for every signed-in user, so the history window opens to
-- everything and the interface — which asks the database rather than deciding
-- for itself — shows no padlocks at all. Nothing is deleted or bypassed; the
-- gate is simply held open.
--
-- To charge for it later:
--   update public.app_settings set paywall_enabled = true;
-- One statement, no deploy, no code change. Flip it back the same way.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- app_settings — exactly one row, forever
--
-- The `id boolean primary key check (id)` trick makes a second row impossible:
-- the only value that satisfies the check is `true`, and the primary key makes
-- it unique. Cheaper and harder to get wrong than a trigger.
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id              boolean primary key default true check (id),
  paywall_enabled boolean not null default false,
  updated_at      timestamptz not null default now()
);

create trigger app_settings_touch
  before update on public.app_settings
  for each row execute function public.touch_updated_at();

insert into public.app_settings (id, paywall_enabled) values (true, false);

alter table public.app_settings enable row level security;

-- Readable so the interface can explain itself; writable only through the
-- service role, like subscriptions. A user who could flip this flag would have
-- found a one-click upgrade for the entire product.
create policy "app_settings: read" on public.app_settings for select
  to authenticated
  using (true);

/**
 * Is the paywall being enforced at all?
 *
 * Defaults to false if the row is somehow missing: an unreadable settings row
 * should open the product, not lock every user out of their own history. This
 * is the one place in the entitlement code where the safe direction is
 * *permissive*, because the failure mode is losing data access, not giving
 * away a subscription.
 */
create or replace function public.paywall_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select s.paywall_enabled from public.app_settings s where s.id), false)
$$;

/**
 * The caller's effective tier — now gated on the switch.
 *
 * Everything downstream (history_floor, every RLS policy, the tier the apps
 * display) already routes through this function, so overriding it here is the
 * whole change. There is no second copy of this decision to keep in step.
 */
create or replace function public.current_tier()
returns public.plan_tier
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.paywall_enabled() then 'premium'::public.plan_tier
    else coalesce(
      (select s.tier
         from public.subscriptions s
        where s.user_id = (select auth.uid())
          and s.status in ('active', 'trialing')
          and (s.current_period_end is null or s.current_period_end > now())
        limit 1),
      'free'::public.plan_tier)
  end
$$;

grant execute on function public.paywall_enabled() to authenticated;

-- ---------------------------------------------------------------------------
-- Re-state the windowed policies, wrapping history_floor() in a sub-select.
--
-- `logged_on >= public.history_floor()` is evaluated once per row; wrapped as
-- `(select public.history_floor())` the planner lifts it into an InitPlan and
-- evaluates it once per query. Identical semantics, and it matters now that
-- the function has one more call in it — and much more once a user has years
-- of rows rather than a week's worth.
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
          and logged_on >= (select public.history_floor())
        );
    $f$, t);
  end loop;
end;
$$;
