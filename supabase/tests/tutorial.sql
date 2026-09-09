-- ============================================================================
-- Behavioural tests for the intro-tutorial gate.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/tutorial.sql
--
-- Two claims are worth testing, and they are both about RLS rather than about
-- the slides: a signed-in user must be able to stamp their OWN column (or the
-- tutorial reappears on every launch and the finish button looks broken), and
-- must not be able to touch anyone else's (or one account could re-trigger the
-- tutorial for another). Everything else about the feature is presentation.
-- ============================================================================

begin;

insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'baru@example.com'),
  ('66666666-6666-6666-6666-666666666666', 'lain@example.com');

do $$
declare
  baru_id uuid := '55555555-5555-5555-5555-555555555555';
  lain_id uuid := '66666666-6666-6666-6666-666666666666';
  seen    timestamptz;
  touched int;
begin
  -- ------------------------------------------------------------------
  -- 1. A brand-new account has not seen it
  -- ------------------------------------------------------------------
  select tutorial_seen_at into seen from public.profiles where id = baru_id;
  if seen is not null then
    raise exception 'FAIL: a new profile starts with tutorial_seen_at = %', seen;
  end if;
  raise notice 'PASS: a new account has not seen the tutorial';

  -- ------------------------------------------------------------------
  -- 2. The user can stamp their own column
  -- ------------------------------------------------------------------
  set local role authenticated;
  set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

  update public.profiles set tutorial_seen_at = now() where id = baru_id;
  get diagnostics touched = row_count;
  if touched <> 1 then
    raise exception
      'FAIL: a user cannot record that they finished the tutorial (% rows)', touched;
  end if;

  select tutorial_seen_at into seen from public.profiles where id = baru_id;
  if seen is null then
    raise exception 'FAIL: the stamp did not survive the update';
  end if;
  raise notice 'PASS: a user can record finishing the tutorial';

  -- ------------------------------------------------------------------
  -- 3. Clearing it is allowed too — that is the "lihat lagi" button
  -- ------------------------------------------------------------------
  update public.profiles set tutorial_seen_at = null where id = baru_id;
  select tutorial_seen_at into seen from public.profiles where id = baru_id;
  if seen is not null then
    raise exception 'FAIL: a user cannot replay their own tutorial';
  end if;
  raise notice 'PASS: a user can clear the stamp to replay the tutorial';

  -- ------------------------------------------------------------------
  -- 4. But not somebody else's
  -- ------------------------------------------------------------------
  update public.profiles set tutorial_seen_at = now() where id = lain_id;
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception
      'FAIL: one account stamped another account''s tutorial column (% rows)', touched;
  end if;

  set local role postgres;
  select tutorial_seen_at into seen from public.profiles where id = lain_id;
  if seen is not null then
    raise exception 'FAIL: the cross-user write actually landed';
  end if;
  raise notice 'PASS: one account cannot touch another account''s tutorial column';

  raise notice '--- all tutorial gate tests passed ---';
end;
$$;

rollback;
