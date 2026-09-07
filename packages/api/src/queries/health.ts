import type {
  DaySummary,
  MoodEntry,
  MoodEntryInput,
  SleepEntry,
  SleepEntryInput,
  StepEntry,
  StepEntryInput,
  WaterEntry,
  WaterEntryInput,
  WeightEntry,
  WeightEntryInput,
} from '@calorya/core';
import { requireUserId, unwrap, unwrapMaybe, type CaloryaClient } from '../client';
import {
  toDaySummary,
  toMoodEntry,
  toSleepEntry,
  toStepEntry,
  toWaterEntry,
  toWeightEntry,
} from '../mappers';

// --- Water ------------------------------------------------------------------

export async function getWaterEntries(
  client: CaloryaClient,
  dateKey: string,
): Promise<WaterEntry[]> {
  const userId = await requireUserId(client);
  const rows = unwrap(
    await client
      .from('water_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('logged_on', dateKey)
      .order('logged_at', { ascending: true }),
    'getWaterEntries',
  );
  return rows.map(toWaterEntry);
}

export async function addWater(
  client: CaloryaClient,
  input: WaterEntryInput,
): Promise<WaterEntry> {
  const userId = await requireUserId(client);
  const row = unwrap(
    await client
      .from('water_entries')
      .insert({
        user_id: userId,
        logged_on: input.loggedOn,
        amount_ml: input.amountMl,
      })
      .select()
      .single(),
    'addWater',
  );
  return toWaterEntry(row);
}

export async function deleteWater(client: CaloryaClient, id: string): Promise<void> {
  const userId = await requireUserId(client);
  const { error } = await client
    .from('water_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(`deleteWater: ${error.message}`);
}

// --- Weight -----------------------------------------------------------------

export async function getWeightEntries(
  client: CaloryaClient,
  fromDate: string,
  toDate: string,
): Promise<WeightEntry[]> {
  const userId = await requireUserId(client);
  const rows = unwrap(
    await client
      .from('weight_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_on', fromDate)
      .lte('logged_on', toDate)
      .order('logged_on', { ascending: true }),
    'getWeightEntries',
  );
  return rows.map(toWeightEntry);
}

export async function getLatestWeight(
  client: CaloryaClient,
): Promise<WeightEntry | null> {
  const userId = await requireUserId(client);
  const row = unwrapMaybe(
    await client
      .from('weight_entries')
      .select('*')
      .eq('user_id', userId)
      .order('logged_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'getLatestWeight',
  );
  return row ? toWeightEntry(row) : null;
}

/** One weigh-in per day; logging twice replaces rather than duplicates. */
export async function upsertWeight(
  client: CaloryaClient,
  input: WeightEntryInput,
): Promise<WeightEntry> {
  const userId = await requireUserId(client);
  const row = unwrap(
    await client
      .from('weight_entries')
      .upsert(
        {
          user_id: userId,
          logged_on: input.loggedOn,
          weight_kg: input.weightKg,
          body_fat_pct: input.bodyFatPct ?? null,
          note: input.note ?? null,
        },
        { onConflict: 'user_id,logged_on' },
      )
      .select()
      .single(),
    'upsertWeight',
  );
  return toWeightEntry(row);
}

// --- Sleep ------------------------------------------------------------------

export async function getSleep(
  client: CaloryaClient,
  dateKey: string,
): Promise<SleepEntry | null> {
  const userId = await requireUserId(client);
  const row = unwrapMaybe(
    await client
      .from('sleep_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('logged_on', dateKey)
      .maybeSingle(),
    'getSleep',
  );
  return row ? toSleepEntry(row) : null;
}

export async function upsertSleep(
  client: CaloryaClient,
  input: SleepEntryInput,
): Promise<SleepEntry> {
  const userId = await requireUserId(client);
  const row = unwrap(
    await client
      .from('sleep_entries')
      .upsert(
        {
          user_id: userId,
          logged_on: input.loggedOn,
          bedtime: input.bedtime ?? null,
          wake_at: input.wakeAt ?? null,
          duration_min: input.durationMin,
          quality: input.quality ?? null,
          note: input.note ?? null,
        },
        { onConflict: 'user_id,logged_on' },
      )
      .select()
      .single(),
    'upsertSleep',
  );
  return toSleepEntry(row);
}

// --- Steps ------------------------------------------------------------------

export async function getSteps(
  client: CaloryaClient,
  dateKey: string,
): Promise<StepEntry | null> {
  const userId = await requireUserId(client);
  const row = unwrapMaybe(
    await client
      .from('step_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('logged_on', dateKey)
      .maybeSingle(),
    'getSteps',
  );
  return row ? toStepEntry(row) : null;
}

export async function upsertSteps(
  client: CaloryaClient,
  input: StepEntryInput,
): Promise<StepEntry> {
  const userId = await requireUserId(client);
  const row = unwrap(
    await client
      .from('step_entries')
      .upsert(
        {
          user_id: userId,
          logged_on: input.loggedOn,
          steps: input.steps,
          distance_m: input.distanceM ?? null,
          source: input.source,
        },
        { onConflict: 'user_id,logged_on' },
      )
      .select()
      .single(),
    'upsertSteps',
  );
  return toStepEntry(row);
}

// --- Mood -------------------------------------------------------------------

export async function getMoodEntries(
  client: CaloryaClient,
  dateKey: string,
): Promise<MoodEntry[]> {
  const userId = await requireUserId(client);
  const rows = unwrap(
    await client
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('logged_on', dateKey)
      .order('logged_at', { ascending: true }),
    'getMoodEntries',
  );
  return rows.map(toMoodEntry);
}

export async function addMood(
  client: CaloryaClient,
  input: MoodEntryInput,
): Promise<MoodEntry> {
  const userId = await requireUserId(client);
  const row = unwrap(
    await client
      .from('mood_entries')
      .insert({
        user_id: userId,
        logged_on: input.loggedOn,
        score: input.score,
        energy: input.energy ?? null,
        note: input.note ?? null,
      })
      .select()
      .single(),
    'addMood',
  );
  return toMoodEntry(row);
}

// --- Rollups ----------------------------------------------------------------

/** Daily summary rows for a window — one query behind every chart. */
export async function getDaySummaries(
  client: CaloryaClient,
  fromDate: string,
  toDate: string,
): Promise<DaySummary[]> {
  const userId = await requireUserId(client);
  const rows = unwrap(
    await client
      .from('daily_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_on', fromDate)
      .lte('logged_on', toDate)
      .order('logged_on', { ascending: true }),
    'getDaySummaries',
  );
  return rows.map(toDaySummary);
}

export async function getDaySummary(
  client: CaloryaClient,
  dateKey: string,
): Promise<DaySummary | null> {
  const summaries = await getDaySummaries(client, dateKey, dateKey);
  return summaries[0] ?? null;
}

/** Days with any activity at all, for streak calculation. */
export async function getActiveDays(
  client: CaloryaClient,
  fromDate: string,
  toDate: string,
): Promise<string[]> {
  const summaries = await getDaySummaries(client, fromDate, toDate);
  return summaries.map((summary) => summary.loggedOn);
}
