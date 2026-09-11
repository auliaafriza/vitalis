import {
  ageYearsOn,
  deriveTargets,
  targetsEqual,
  trendWeightKg,
  type DateKey,
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

  const targets = deriveTargets(
    {
      sex: input.sex,
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      ageYears: ageYearsOn(input.birthDate, todayKey),
    },
    input.activityLevel,
    input.goal,
  );

  // 'auto': these came out of the formula, so a later weigh-in is free to
  // refine them without asking.
  return saveTargets(client, targets, todayKey, 'auto');
}

/**
 * Write a new target version effective from `dateKey`.
 *
 * `source` defaults to 'manual' on purpose. Every caller that writes derived
 * numbers says so explicitly; anything that forgets is treated as a user's
 * own figure and protected from being recalculated, which is the safe way to
 * be wrong.
 */
export async function saveTargets(
  client: CaloryaClient,
  targets: TargetsInput | Targets,
  dateKey: string,
  source: 'auto' | 'manual' = 'manual',
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
          source,
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

/** The profile fields that change what the daily targets should be. */
const TARGET_INPUT_FIELDS = ['goal', 'heightCm', 'activityLevel'] as const;

export async function updateProfile(
  client: CaloryaClient,
  patch: Partial<Pick<Profile, 'fullName' | 'activityLevel' | 'goal' | 'timezone' | 'heightCm'>>,
  /**
   * Today, in the user's timezone. Pass it and the daily targets are
   * recalculated when the patch touches goal, height or activity level.
   *
   * Optional so the parameter can be added without breaking callers that
   * only rename someone — but every screen that can change a target input
   * passes it, because a goal button that changes the label and nothing else
   * is a button that lies.
   */
  todayKey?: DateKey,
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

  const touchedTargetInput = TARGET_INPUT_FIELDS.some(
    (field) => patch[field] !== undefined,
  );
  if (todayKey && touchedTargetInput) {
    /*
     * `force`, because this is an explicit act.
     *
     * Choosing a different goal is the user saying "recalculate my plan", so
     * it may replace hand-typed targets. A passive weigh-in may not — see
     * recomputeTargets.
     */
    await recomputeTargets(client, todayKey, { force: true });
  }

  return toProfile(row);
}

/**
 * Recalculate today's targets from the profile and the recent weigh-ins.
 *
 * This is what makes the daily targets follow the body rather than freeze at
 * whatever it was on the day of setup. Before it existed, `deriveTargets` ran
 * exactly once — during onboarding — so someone who lost 12 kg was still being
 * fed the calorie budget of the person they used to be, and someone who
 * switched from "turunkan berat" to "naikkan massa otot" got a new label on
 * the settings screen and not one changed number anywhere else.
 *
 * Three things stop it from being annoying:
 *
 *   1. It builds on a *trend* weight, not this morning's number, so ordinary
 *      day-to-day scale noise does not move the target (see `trendWeightKg`).
 *   2. It writes nothing when the result is identical to what is already
 *      stored, so the versioned history stays meaningful instead of filling
 *      with one row per weigh-in.
 *   3. It refuses to overwrite targets the user typed themselves unless
 *      `force` is set.
 *
 * Returns the targets in force afterwards, or null when the profile is not
 * complete enough to derive anything (no birth date, sex, height, or no
 * weight ever logged) — a new account mid-setup, not an error.
 */
export async function recomputeTargets(
  client: CaloryaClient,
  asOf: DateKey,
  options: { force?: boolean } = {},
): Promise<Targets | null> {
  const userId = await requireUserId(client);

  const profileRow = unwrapMaybe(
    await client.from('profiles').select('*').eq('id', userId).single(),
    'recomputeTargets/profile',
  );
  if (!profileRow) return null;

  const profile = toProfile(profileRow);
  if (!profile.birthDate || !profile.sex || !profile.heightCm) return null;

  /*
   * Weigh-ins are read directly rather than through getWeightEntries so that
   * this module does not import health.ts — health.ts imports *this* one, and
   * a cycle between the two would be a real problem in the Metro bundler.
   *
   * 60 days is a wide enough net for the 14-day trend window even for someone
   * who weighs in fortnightly, and small enough to stay a cheap query.
   */
  const since = shiftDateKey(asOf, -60);
  const weightRows = unwrap(
    await client
      .from('weight_entries')
      .select('logged_on, weight_kg')
      .eq('user_id', userId)
      .gte('logged_on', since)
      .lte('logged_on', asOf)
      .order('logged_on', { ascending: false }),
    'recomputeTargets/weights',
  );

  const weightKg = trendWeightKg(
    weightRows.map((r) => ({ loggedOn: r.logged_on, weightKg: r.weight_kg })),
    asOf,
  );
  if (weightKg === null) return null;

  const existing = unwrapMaybe(
    await client
      .from('targets')
      .select('*')
      .eq('user_id', userId)
      .lte('effective_from', asOf)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'recomputeTargets/existing',
  );

  // The user's own numbers stay the user's own numbers.
  if (existing && existing.source === 'manual' && !options.force) {
    return toTargets(existing);
  }

  const next = deriveTargets(
    {
      sex: profile.sex,
      weightKg,
      heightCm: profile.heightCm,
      ageYears: ageYearsOn(profile.birthDate, asOf),
    },
    profile.activityLevel,
    profile.goal,
  );

  /*
   * Nothing moved, and the row already starts today — no reason to write.
   *
   * The `effective_from` check matters: if the identical targets are in force
   * but were set three weeks ago, there is still nothing to say, because
   * today already resolves to them. Only a genuine change earns a new row.
   */
  if (existing && existing.source !== 'manual' && targetsEqual(toTargets(existing), next)) {
    return toTargets(existing);
  }

  return saveTargets(client, next, asOf, 'auto');
}

/** YYYY-MM-DD arithmetic, local to this module. */
function shiftDateKey(key: DateKey, days: number): DateKey {
  const at = new Date(`${key}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}
