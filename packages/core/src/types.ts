/**
 * Domain types shared by every platform.
 *
 * These mirror the database schema but are deliberately *not* generated from
 * it: the app should be able to reason about a "day of eating" without a
 * Supabase client anywhere in scope. Mapping happens in @calorya/api.
 */

export type Sex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type Goal = 'lose' | 'maintain' | 'gain';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** A date in the user's local timezone, formatted YYYY-MM-DD. */
export type DateKey = string;

export interface Profile {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  birthDate: string | null;
  sex: Sex | null;
  heightCm: number | null;
  activityLevel: ActivityLevel;
  goal: Goal;
  timezone: string;
  onboardedAt: string | null;
}

/** Daily goals. Everything the rings on the dashboard fill up against. */
export interface Targets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
  sleepMin: number;
  steps: number;
}

/** The seven numbers we track for any amount of food. */
export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
}

/** A catalogue item. All nutrient values are per 100 g (or per 100 ml). */
export interface Food extends Nutrients {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingLabel: string | null;
  servingG: number | null;
  isLiquid: boolean;
  isPublic: boolean;
  createdBy: string | null;
}

/** One logged portion. Nutrients here are an immutable snapshot. */
export interface FoodEntry extends Nutrients {
  id: string;
  foodId: string;
  foodName: string;
  loggedOn: DateKey;
  loggedAt: string;
  meal: MealType;
  quantityG: number;
}

export interface WeightEntry {
  id: string;
  loggedOn: DateKey;
  weightKg: number;
  bodyFatPct: number | null;
  note: string | null;
}

export interface WaterEntry {
  id: string;
  loggedOn: DateKey;
  loggedAt: string;
  amountMl: number;
}

export interface SleepEntry {
  id: string;
  loggedOn: DateKey;
  bedtime: string | null;
  wakeAt: string | null;
  durationMin: number;
  quality: number | null;
  note: string | null;
}

export interface StepEntry {
  id: string;
  loggedOn: DateKey;
  steps: number;
  distanceM: number | null;
  source: string;
}

export interface MoodEntry {
  id: string;
  loggedOn: DateKey;
  loggedAt: string;
  score: number;
  energy: number | null;
  note: string | null;
}

/** One row of the daily_summary view — the shape charts consume. */
export interface DaySummary {
  loggedOn: DateKey;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
  sleepMin: number | null;
  steps: number | null;
  moodAvg: number | null;
  weightKg: number | null;
}

export const MEAL_TYPES: readonly MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
] as const;

export const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
] as const;
