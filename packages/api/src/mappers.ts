import type {
  DaySummary,
  Food,
  FoodEntry,
  MoodEntry,
  Profile,
  SleepEntry,
  StepEntry,
  Targets,
  WaterEntry,
  WeightEntry,
} from '@vitalis/core';
import type { Database } from './database.types';

/**
 * snake_case rows in, camelCase domain objects out.
 *
 * Keeping this boundary explicit means the UI never sees a database column
 * name, and renaming a column is a one-file change.
 */

type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];

/** Postgres numerics arrive as numbers via PostgREST, but be defensive. */
const num = (value: number | string | null, fallback = 0): number =>
  value === null ? fallback : typeof value === 'number' ? value : Number(value);

const nullableNum = (value: number | string | null): number | null =>
  value === null ? null : num(value);

export function toProfile(row: Tables['profiles']['Row']): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    birthDate: row.birth_date,
    sex: row.sex,
    heightCm: nullableNum(row.height_cm),
    activityLevel: row.activity_level,
    goal: row.goal,
    timezone: row.timezone,
    onboardedAt: row.onboarded_at,
  };
}

export function toTargets(row: Tables['targets']['Row']): Targets {
  return {
    kcal: row.kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fiberG: row.fiber_g,
    waterMl: row.water_ml,
    sleepMin: row.sleep_min,
    steps: row.steps,
  };
}

export function toFood(row: Tables['foods']['Row']): Food {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    kcal: num(row.kcal),
    proteinG: num(row.protein_g),
    carbsG: num(row.carbs_g),
    fatG: num(row.fat_g),
    fiberG: num(row.fiber_g),
    sugarG: num(row.sugar_g),
    sodiumMg: num(row.sodium_mg),
    servingLabel: row.serving_label,
    servingG: nullableNum(row.serving_g),
    isLiquid: row.is_liquid,
    isPublic: row.is_public,
    createdBy: row.created_by,
  };
}

export function toFoodEntry(row: Tables['food_entries']['Row']): FoodEntry {
  return {
    id: row.id,
    foodId: row.food_id,
    foodName: row.food_name,
    loggedOn: row.logged_on,
    loggedAt: row.logged_at,
    meal: row.meal,
    quantityG: num(row.quantity_g),
    kcal: num(row.kcal),
    proteinG: num(row.protein_g),
    carbsG: num(row.carbs_g),
    fatG: num(row.fat_g),
    fiberG: num(row.fiber_g),
    sugarG: num(row.sugar_g),
    sodiumMg: num(row.sodium_mg),
  };
}

export function toWeightEntry(row: Tables['weight_entries']['Row']): WeightEntry {
  return {
    id: row.id,
    loggedOn: row.logged_on,
    weightKg: num(row.weight_kg),
    bodyFatPct: nullableNum(row.body_fat_pct),
    note: row.note,
  };
}

export function toWaterEntry(row: Tables['water_entries']['Row']): WaterEntry {
  return {
    id: row.id,
    loggedOn: row.logged_on,
    loggedAt: row.logged_at,
    amountMl: row.amount_ml,
  };
}

export function toSleepEntry(row: Tables['sleep_entries']['Row']): SleepEntry {
  return {
    id: row.id,
    loggedOn: row.logged_on,
    bedtime: row.bedtime,
    wakeAt: row.wake_at,
    durationMin: row.duration_min,
    quality: row.quality,
    note: row.note,
  };
}

export function toStepEntry(row: Tables['step_entries']['Row']): StepEntry {
  return {
    id: row.id,
    loggedOn: row.logged_on,
    steps: row.steps,
    distanceM: row.distance_m,
    source: row.source,
  };
}

export function toMoodEntry(row: Tables['mood_entries']['Row']): MoodEntry {
  return {
    id: row.id,
    loggedOn: row.logged_on,
    loggedAt: row.logged_at,
    score: row.score,
    energy: row.energy,
    note: row.note,
  };
}

export function toDaySummary(row: Views['daily_summary']['Row']): DaySummary {
  return {
    loggedOn: row.logged_on,
    kcal: num(row.kcal),
    proteinG: num(row.protein_g),
    carbsG: num(row.carbs_g),
    fatG: num(row.fat_g),
    fiberG: num(row.fiber_g),
    waterMl: num(row.water_ml),
    sleepMin: nullableNum(row.sleep_min),
    steps: nullableNum(row.steps),
    moodAvg: nullableNum(row.mood_avg),
    weightKg: nullableNum(row.weight_kg),
  };
}
