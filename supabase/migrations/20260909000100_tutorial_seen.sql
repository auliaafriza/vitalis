-- ============================================================================
-- Calorya — "sudah pernah lihat tutorial?"
--
-- A column on profiles rather than device storage, for one reason: the same
-- person signs in on the phone and on the web with the same account, and
-- being walked through the same five slides a second time is not a welcome,
-- it is an insult. AsyncStorage and localStorage cannot know about each other.
--
-- Deliberately a timestamp, not a boolean. `onboarded_at` next to it is a
-- timestamp for the same reason: knowing *when* someone finished the intro is
-- worth something later (did the people who skipped it churn faster?), and a
-- boolean throws that away for no saving.
--
-- NULL means "has not finished it", which is what every existing row gets —
-- so people already using the app will see the tutorial once. That is the
-- right default: it is new to them too.
-- ============================================================================

-- `if not exists` supaya berkas ini aman dijalankan dua kali: sekali lewat
-- SQL Editor saat mendesak, sekali lagi lewat `supabase db push` nanti.
alter table public.profiles
  add column if not exists tutorial_seen_at timestamptz;

comment on column public.profiles.tutorial_seen_at is
  'When the intro slides were finished or skipped. NULL = not yet shown.';

-- No new policy is needed: profiles already carries an UPDATE policy scoped to
-- auth.uid() = id, so a user can stamp their own column and nobody else''s.
-- Asserted rather than assumed — a silent missing policy here would show the
-- tutorial forever, on every launch, and look like a bug in the client.
do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename  = 'profiles'
       and cmd        = 'UPDATE'
  ) then
    raise exception
      'profiles has no UPDATE policy; tutorial_seen_at could never be stamped';
  end if;
end
$$;
