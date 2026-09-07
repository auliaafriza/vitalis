-- ============================================================================
-- Calorya — initial schema
-- Daily health tracking (weight, water, sleep, steps, mood) + nutrition logging
--
-- Design notes:
--   * Every user-owned table carries user_id and is protected by RLS.
--   * Food entries store a *snapshot* of nutrition values so that editing a
--     food later never rewrites history. This is the single most important
--     correctness decision in the schema.
--   * "logged_on" is a plain date in the *user's* local timezone, resolved on
--     the client. Storing it as a date (not a timestamptz) is what makes
--     "what did I eat today" stable across travel and DST.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.sex_type       as enum ('male', 'female');
create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type public.goal_type      as enum ('lose', 'maintain', 'gain');
create type public.meal_type      as enum ('breakfast', 'lunch', 'dinner', 'snack');

-- ---------------------------------------------------------------------------
-- Shared helper: keep updated_at honest
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text,
  avatar_url      text,
  birth_date      date,
  sex             public.sex_type,
  height_cm       numeric(5, 1) check (height_cm is null or height_cm between 80 and 260),
  activity_level  public.activity_level not null default 'moderate',
  goal            public.goal_type      not null default 'maintain',
  timezone        text not null default 'Asia/Jakarta',
  onboarded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- targets — daily goals, versioned by effective_from so history stays truthful
-- ---------------------------------------------------------------------------
create table public.targets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  effective_from date not null default current_date,
  kcal           integer not null check (kcal between 800 and 8000),
  protein_g      integer not null check (protein_g >= 0),
  carbs_g        integer not null check (carbs_g   >= 0),
  fat_g          integer not null check (fat_g     >= 0),
  fiber_g        integer not null default 25 check (fiber_g >= 0),
  water_ml       integer not null default 2000 check (water_ml between 500 and 8000),
  sleep_min      integer not null default 480  check (sleep_min between 120 and 900),
  steps          integer not null default 8000 check (steps >= 0),
  created_at     timestamptz not null default now(),
  unique (user_id, effective_from)
);

create index targets_user_effective_idx
  on public.targets (user_id, effective_from desc);

-- ---------------------------------------------------------------------------
-- Daily health entries
-- ---------------------------------------------------------------------------
create table public.weight_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  logged_on     date not null default current_date,
  weight_kg     numeric(5, 2) not null check (weight_kg between 20 and 400),
  body_fat_pct  numeric(4, 1) check (body_fat_pct is null or body_fat_pct between 1 and 70),
  note          text,
  created_at    timestamptz not null default now(),
  unique (user_id, logged_on)
);

create table public.water_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  logged_on  date not null default current_date,
  logged_at  timestamptz not null default now(),
  amount_ml  integer not null check (amount_ml between 1 and 3000),
  created_at timestamptz not null default now()
);

create index water_entries_user_day_idx on public.water_entries (user_id, logged_on);

create table public.sleep_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- the date you WOKE UP on; a night is attributed to the morning it ends
  logged_on    date not null default current_date,
  bedtime      timestamptz,
  wake_at      timestamptz,
  duration_min integer not null check (duration_min between 0 and 1440),
  quality      smallint check (quality is null or quality between 1 and 5),
  note         text,
  created_at   timestamptz not null default now(),
  unique (user_id, logged_on),
  constraint sleep_times_ordered check (
    bedtime is null or wake_at is null or wake_at > bedtime
  )
);

create table public.step_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  logged_on  date not null default current_date,
  steps      integer not null check (steps between 0 and 200000),
  distance_m integer check (distance_m is null or distance_m >= 0),
  -- 'manual' | 'healthkit' | 'google_fit' | 'pedometer'
  source     text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create trigger step_entries_touch
  before update on public.step_entries
  for each row execute function public.touch_updated_at();

create table public.mood_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  logged_on  date not null default current_date,
  logged_at  timestamptz not null default now(),
  score      smallint not null check (score  between 1 and 5),
  energy     smallint check (energy is null or energy between 1 and 5),
  note       text,
  created_at timestamptz not null default now()
);

create index mood_entries_user_day_idx on public.mood_entries (user_id, logged_on);

-- ---------------------------------------------------------------------------
-- foods — nutrition per 100 g (or per 100 ml for liquids)
-- ---------------------------------------------------------------------------
create table public.foods (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  brand         text,
  barcode       text,
  kcal          numeric(7, 2) not null check (kcal      >= 0),
  protein_g     numeric(6, 2) not null default 0 check (protein_g >= 0),
  carbs_g       numeric(6, 2) not null default 0 check (carbs_g   >= 0),
  fat_g         numeric(6, 2) not null default 0 check (fat_g     >= 0),
  fiber_g       numeric(6, 2) not null default 0 check (fiber_g   >= 0),
  sugar_g       numeric(6, 2) not null default 0 check (sugar_g   >= 0),
  sodium_mg     numeric(7, 2) not null default 0 check (sodium_mg >= 0),
  -- a human-sized portion, e.g. "1 piring" = 250 g
  serving_label text,
  serving_g     numeric(7, 2) check (serving_g is null or serving_g > 0),
  is_liquid     boolean not null default false,
  is_public     boolean not null default false,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(brand, ''))
  ) stored
);

create index foods_search_idx  on public.foods using gin (search_vector);
create index foods_barcode_idx on public.foods (barcode) where barcode is not null;
create index foods_owner_idx   on public.foods (created_by);

-- ---------------------------------------------------------------------------
-- food_entries — what you actually ate
--
-- The nutrition columns are a SNAPSHOT, computed by trigger at write time.
-- Editing a food tomorrow must never silently rewrite yesterday's calories.
-- ---------------------------------------------------------------------------
create table public.food_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  food_id     uuid not null references public.foods (id) on delete restrict,
  logged_on   date not null default current_date,
  logged_at   timestamptz not null default now(),
  meal        public.meal_type not null,
  quantity_g  numeric(7, 2) not null check (quantity_g > 0 and quantity_g <= 5000),
  -- snapshot (filled by trigger, never by the client)
  food_name   text          not null default '',
  kcal        numeric(9, 2) not null default 0,
  protein_g   numeric(8, 2) not null default 0,
  carbs_g     numeric(8, 2) not null default 0,
  fat_g       numeric(8, 2) not null default 0,
  fiber_g     numeric(8, 2) not null default 0,
  sugar_g     numeric(8, 2) not null default 0,
  sodium_mg   numeric(9, 2) not null default 0,
  created_at  timestamptz not null default now()
);

create index food_entries_user_day_idx on public.food_entries (user_id, logged_on, meal);

create or replace function public.snapshot_food_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.foods%rowtype;
  factor numeric;
begin
  select * into f from public.foods where id = new.food_id;
  if not found then
    raise exception 'food % not found', new.food_id;
  end if;

  -- foods store nutrition per 100 g
  factor := new.quantity_g / 100.0;

  new.food_name := f.name;
  new.kcal      := round(f.kcal      * factor, 2);
  new.protein_g := round(f.protein_g * factor, 2);
  new.carbs_g   := round(f.carbs_g   * factor, 2);
  new.fat_g     := round(f.fat_g     * factor, 2);
  new.fiber_g   := round(f.fiber_g   * factor, 2);
  new.sugar_g   := round(f.sugar_g   * factor, 2);
  new.sodium_mg := round(f.sodium_mg * factor, 2);

  return new;
end;
$$;

create trigger food_entries_snapshot
  before insert or update of food_id, quantity_g on public.food_entries
  for each row execute function public.snapshot_food_entry();

-- ---------------------------------------------------------------------------
-- New-user bootstrap: profile + a sensible default target row
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

  -- placeholder targets; onboarding overwrites these with calculated values
  insert into public.targets (user_id, kcal, protein_g, carbs_g, fat_g)
  values (new.id, 2000, 120, 220, 65)
  on conflict (user_id, effective_from) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Views — daily rollups. security_invoker keeps RLS in force.
-- ---------------------------------------------------------------------------
create view public.daily_nutrition
with (security_invoker = true) as
select
  user_id,
  logged_on,
  round(sum(kcal))::int      as kcal,
  round(sum(protein_g))::int as protein_g,
  round(sum(carbs_g))::int   as carbs_g,
  round(sum(fat_g))::int     as fat_g,
  round(sum(fiber_g))::int   as fiber_g,
  round(sum(sugar_g))::int   as sugar_g,
  round(sum(sodium_mg))::int as sodium_mg,
  count(*)::int              as entry_count
from public.food_entries
group by user_id, logged_on;

create view public.daily_summary
with (security_invoker = true) as
with days as (
  select user_id, logged_on from public.food_entries
  union select user_id, logged_on from public.water_entries
  union select user_id, logged_on from public.sleep_entries
  union select user_id, logged_on from public.step_entries
  union select user_id, logged_on from public.mood_entries
  union select user_id, logged_on from public.weight_entries
)
select
  d.user_id,
  d.logged_on,
  coalesce(n.kcal, 0)                                       as kcal,
  coalesce(n.protein_g, 0)                                  as protein_g,
  coalesce(n.carbs_g, 0)                                    as carbs_g,
  coalesce(n.fat_g, 0)                                      as fat_g,
  coalesce(n.fiber_g, 0)                                    as fiber_g,
  coalesce((select sum(amount_ml)::int from public.water_entries w
             where w.user_id = d.user_id and w.logged_on = d.logged_on), 0) as water_ml,
  (select s.duration_min from public.sleep_entries s
     where s.user_id = d.user_id and s.logged_on = d.logged_on)             as sleep_min,
  (select st.steps from public.step_entries st
     where st.user_id = d.user_id and st.logged_on = d.logged_on)           as steps,
  (select round(avg(m.score), 1) from public.mood_entries m
     where m.user_id = d.user_id and m.logged_on = d.logged_on)             as mood_avg,
  (select wt.weight_kg from public.weight_entries wt
     where wt.user_id = d.user_id and wt.logged_on = d.logged_on)           as weight_kg
from days d
left join public.daily_nutrition n
  on n.user_id = d.user_id and n.logged_on = d.logged_on;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.targets        enable row level security;
alter table public.weight_entries enable row level security;
alter table public.water_entries  enable row level security;
alter table public.sleep_entries  enable row level security;
alter table public.step_entries   enable row level security;
alter table public.mood_entries   enable row level security;
alter table public.foods          enable row level security;
alter table public.food_entries   enable row level security;

-- profiles: you, and only you
create policy "profiles: read own"   on public.profiles for select using  ((select auth.uid()) = id);
create policy "profiles: write own"  on public.profiles for update using  ((select auth.uid()) = id)
                                                             with check ((select auth.uid()) = id);
create policy "profiles: insert own" on public.profiles for insert with check ((select auth.uid()) = id);

-- every user-owned table gets the same four policies
do $$
declare t text;
begin
  foreach t in array array[
    'targets', 'weight_entries', 'water_entries', 'sleep_entries',
    'step_entries', 'mood_entries', 'food_entries'
  ]
  loop
    execute format($f$
      create policy "%1$s: read own"   on public.%1$I for select
        using ((select auth.uid()) = user_id);
      create policy "%1$s: insert own" on public.%1$I for insert
        with check ((select auth.uid()) = user_id);
      create policy "%1$s: update own" on public.%1$I for update
        using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
      create policy "%1$s: delete own" on public.%1$I for delete
        using ((select auth.uid()) = user_id);
    $f$, t);
  end loop;
end;
$$;

-- foods: shared catalogue is readable by all signed-in users;
--        private foods only by their author. Only the author may edit.
create policy "foods: read public or own" on public.foods for select
  using (is_public or (select auth.uid()) = created_by);

create policy "foods: insert own" on public.foods for insert
  with check ((select auth.uid()) = created_by);

create policy "foods: update own" on public.foods for update
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "foods: delete own" on public.foods for delete
  using ((select auth.uid()) = created_by);

-- ---------------------------------------------------------------------------
-- Search RPC — ranked full-text search over the catalogue the caller can see
-- ---------------------------------------------------------------------------
create or replace function public.search_foods(query text, max_results int default 25)
returns setof public.foods
language sql
stable
as $$
  select *
  from public.foods
  where query is null
     or length(trim(query)) = 0
     or search_vector @@ plainto_tsquery('simple', query)
     or name ilike '%' || query || '%'
  order by
    -- exact prefix matches first, then full-text rank, then alphabetically.
    -- nullif() keeps an empty query from emitting a "no lexemes" notice.
    (name ilike coalesce(query, '') || '%') desc,
    ts_rank(
      search_vector,
      plainto_tsquery('simple', coalesce(nullif(trim(query), ''), 'zzzznomatch'))
    ) desc,
    name
  limit least(coalesce(max_results, 25), 100);
$$;

grant execute on function public.search_foods(text, int) to authenticated;
