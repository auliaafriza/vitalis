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

  unwrap(
    await client
      .from('profiles')
      .update({
        full_name: input.fullName,
        birth_date: input.birthDate,
        sex: input.sex,
        height_cm: input.heightCm,
        activity_level: input.activityLevel,
        goal: input.goal,
        timezone: input.timezone,
        onboarded_at: new Date().toISOString(),
      })
      .eq('id', userId)
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
