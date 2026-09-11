-- Targets: remember who wrote them.
--
-- Daily targets are now recomputed automatically whenever the inputs move —
-- a new weigh-in, a changed goal, a corrected height. That is only safe if
-- the app can tell its own arithmetic apart from a number the user typed by
-- hand on the settings screen. Without this column the first weigh-in after
-- a manual edit would silently overwrite it, and the target editor would be
-- a button that undoes itself.
--
-- 'auto'   — derived by deriveTargets(); free to be recalculated.
-- 'manual' — typed by the user; only an explicit act replaces it (changing
--            the goal, or pressing "hitung ulang otomatis").
--
-- Existing rows default to 'auto'. That is the deliberate choice: before this
-- migration every row came from onboarding or from the editor, and treating
-- the older ones as replaceable means a user whose weight has changed since
-- setup finally gets targets that match the body they have now.

alter table public.targets
  add column if not exists source text not null default 'auto';

-- Separate from the ADD so re-running the migration on a database that
-- already has the column still ends up with the constraint.
do $$
begin
  alter table public.targets
    add constraint targets_source_check check (source in ('auto', 'manual'));
exception
  when duplicate_object then null;
end
$$;

comment on column public.targets.source is
  'auto = derived from the profile; manual = typed by the user and protected from recomputation.';
