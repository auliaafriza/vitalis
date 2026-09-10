import {
  deriveTargets,
  type OnboardingInput,
  type Profile,
  type Targets,
  type TargetsInput,
} from '@calorya/core';
import { requireUserId, unwrap, unwrapMaybe, type CaloryaClient } from '../client';
import { toProfile, toTargets } from '../mappers';

export async function getProfile(client: CaloryaClient): Promise<Profile | null> {
  const userId = await requireUserId(client);
  const row = unwrapMaybe(
    await client.from('profiles').select('*').eq('id', userId).single(),
    'getProfile',
  );
  return row ? toProfile(row) : null;
}

/**
 * The targets in force on a given day.
 *
 * Targets are versioned by effective_from, so a chart of last month is scored
 * against the goals the user actually had then — not the ones they set today.
 */
export async function getTargetsFor(
  client: CaloryaClient,
  dateKey: string,
): Promise<Targets | null> {
  const userId = await requireUserId(client);
  const row = unwrapMaybe(
    await client
      .from('targets')
      .select('*')
      .eq('user_id', userId)
      .lte('effective_from', dateKey)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'getTargetsFor',
  );
  return row ? toTargets(row) : null;
}

/**
 * Complete onboarding: save the profile, record the starting weight, and
 * derive the first set of targets from the answers.
 */
export async function completeOnboarding(
  client: CaloryaClient,
  input: OnboardingInput,
  todayKey: string,
): Promise<Targets> {
  const userId = await requireUserId(client);

  /*
   * Upsert, not update.
   *
   * `handle_new_user` normally creates the profile row the moment the account
   * is created, so an UPDATE was enough — until a row went missing. Then the
   * update matched nothing, `.single()` threw, and the person was pinned to
   * the setup form forever: every attempt to finish it failed, and the gate
   * would not let them past until it succeeded.
   *
   * Rows go missing for ordinary reasons — an account created before the
   * trigger existed, a trigger added after the fact, a row deleted by hand
   * during testing. None of them deserve an account that cannot be used.
   *
   * The insert still cannot invent an account: `profiles.id` references
   * auth.users, so a session whose user has been deleted fails here with a
   * foreign-key error rather than quietly creating an orphan.
   */
  unwrap(
    await client
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: input.fullName,
          birth_date: input.birthDate,
          sex: input.sex,
          height_cm: input.heightCm,
          activity_level: input.activityLevel,
          goal: input.goal,
          timezone: input.timezone,
          onboarded_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select()
      .single(),
    'completeOnboarding/profile',
  );

  unwrap(
    await client
      .from('weight_entries')
      .upsert(
        { user_id: userId, logged_on: todayKey, weight_kg: input.weightKg },
        { onConflict: 'user_id,logged_on' },
      )
      .select()
      .single(),
    'completeOnboarding/weight',
  );

  const ageYears = Math.floor(
    (Date.now() - new Date(input.birthDate).getTime()) / 31_557_600_000,
  );

  const targets = deriveTargets(
    {
      sex: input.sex,
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      ageYears,
    },
    input.activityLevel,
    input.goal,
  );

  return saveTargets(client, targets, todayKey);
}

/** Write a new target version effective from `dateKey`. */
export async function saveTargets(
  client: CaloryaClient,
  targets: TargetsInput | Targets,
  dateKey: string,
): Promise<Targets> {
  const userId = await requireUserId(client);
  const row = unwrap(
    await client
      .from('targets')
      .upsert(
        {
          user_id: userId,
          effective_from: dateKey,
          kcal: Math.round(targets.kcal),
          protein_g: Math.round(targets.proteinG),
          carbs_g: Math.round(targets.carbsG),
          fat_g: Math.round(targets.fatG),
          fiber_g: Math.round(targets.fiberG),
          water_ml: Math.round(targets.waterMl),
          sleep_min: Math.round(targets.sleepMin),
          steps: Math.round(targets.steps),
        },
        { onConflict: 'user_id,effective_from' },
      )
      .select()
      .single(),
    'saveTargets',
  );
  return toTargets(row);
}

/**
 * Mark the intro slides as done — whether they were read or skipped.
 *
 * Skipping stamps the same column as finishing, deliberately. A person who
 * taps "Lewati" has said what they want; showing the slides again on their
 * next launch would be arguing with them.
 *
 * `null` puts it back, which is what the "Lihat tutorial lagi" button uses:
 * the same gate that shows it to a new account then shows it again, so there
 * is only one code path that can decide whether the tutorial appears.
 */
export async function setTutorialSeen(
  client: CaloryaClient,
  seen: boolean,
): Promise<Profile> {
  const userId = await requireUserId(client);
  const row = unwrap(
    await client
      .from('profiles')
      .update({ tutorial_seen_at: seen ? new Date().toISOString() : null })
      .eq('id', userId)
      .select()
      .single(),
    'setTutorialSeen',
  );
  return toProfile(row);
}

export async function updateProfile(
  client: CaloryaClient,
  patch: Partial<Pick<Profile, 'fullName' | 'activityLevel' | 'goal' | 'timezone' | 'heightCm'>>,
): Promise<Profile> {
  const userId = await requireUserId(client);
  const row = unwrap(
    await client
      .from('profiles')
      .update({
        ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
        ...(patch.activityLevel !== undefined ? { activity_level: patch.activityLevel } : {}),
        ...(patch.goal !== undefined ? { goal: patch.goal } : {}),
        ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
        ...(patch.heightCm !== undefined ? { height_cm: patch.heightCm } : {}),
      })
      .eq('id', userId)
      .select()
      .single(),
    'updateProfile',
  );
  return toProfile(row);
}
