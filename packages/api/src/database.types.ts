/**
 * Database types.
 *
 * In day-to-day work this file is generated:
 *   npm run db:types
 * (which runs `supabase gen types typescript --local`). It is committed so the
 * repo typechecks in CI without a database, and hand-maintained here to match
 * supabase/migrations exactly.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type SexType = 'male' | 'female';
export type ActivityLevelType = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose' | 'maintain' | 'gain';
export type MealTypeDb = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  sex: SexType | null;
  height_cm: number | null;
  activity_level: ActivityLevelType;
  goal: GoalType;
  timezone: string;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

type TargetsRow = {
  id: string;
  user_id: string;
  effective_from: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_ml: number;
  sleep_min: number;
  steps: number;
  created_at: string;
}

type WeightRow = {
  id: string;
  user_id: string;
  logged_on: string;
  weight_kg: number;
  body_fat_pct: number | null;
  note: string | null;
  created_at: string;
}

type WaterRow = {
  id: string;
  user_id: string;
  logged_on: string;
  logged_at: string;
  amount_ml: number;
  created_at: string;
}

type SleepRow = {
  id: string;
  user_id: string;
  logged_on: string;
  bedtime: string | null;
  wake_at: string | null;
  duration_min: number;
  quality: number | null;
  note: string | null;
  created_at: string;
}

type StepRow = {
  id: string;
  user_id: string;
  logged_on: string;
  steps: number;
  distance_m: number | null;
  source: string;
  created_at: string;
  updated_at: string;
}

type MoodRow = {
  id: string;
  user_id: string;
  logged_on: string;
  logged_at: string;
  score: number;
  energy: number | null;
  note: string | null;
  created_at: string;
}

type FoodRow = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  serving_label: string | null;
  serving_g: number | null;
  is_liquid: boolean;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
}

type FoodEntryRow = {
  id: string;
  user_id: string;
  food_id: string;
  logged_on: string;
  logged_at: string;
  meal: MealTypeDb;
  quantity_g: number;
  food_name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  created_at: string;
}

type DailySummaryRow = {
  user_id: string;
  logged_on: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_ml: number;
  sleep_min: number | null;
  steps: number | null;
  mood_avg: number | null;
  weight_kg: number | null;
}

/** Keys whose column accepts NULL, and which are therefore optional on insert. */
type NullableKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

/**
 * Columns the client is allowed to send.
 * `Generated` names columns the database fills in itself — defaults, and the
 * nutrition snapshot written by the food_entries trigger. Nullable columns are
 * optional too, so a minimal insert typechecks.
 */
type Insert<T, Generated extends keyof T> = Omit<T, Generated | NullableKeys<T>> &
  Partial<Pick<T, Generated | NullableKeys<T>>>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insert<ProfileRow, 'created_at' | 'updated_at' | 'timezone' | 'activity_level' | 'goal'>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      targets: {
        Row: TargetsRow;
        Insert: Insert<TargetsRow, 'id' | 'created_at' | 'effective_from' | 'fiber_g' | 'water_ml' | 'sleep_min' | 'steps'>;
        Update: Partial<TargetsRow>;
        Relationships: [];
      };
      weight_entries: {
        Row: WeightRow;
        Insert: Insert<WeightRow, 'id' | 'created_at' | 'logged_on'>;
        Update: Partial<WeightRow>;
        Relationships: [];
      };
      water_entries: {
        Row: WaterRow;
        Insert: Insert<WaterRow, 'id' | 'created_at' | 'logged_at' | 'logged_on'>;
        Update: Partial<WaterRow>;
        Relationships: [];
      };
      sleep_entries: {
        Row: SleepRow;
        Insert: Insert<SleepRow, 'id' | 'created_at' | 'logged_on'>;
        Update: Partial<SleepRow>;
        Relationships: [];
      };
      step_entries: {
        Row: StepRow;
        Insert: Insert<StepRow, 'id' | 'created_at' | 'updated_at' | 'logged_on' | 'source'>;
        Update: Partial<StepRow>;
        Relationships: [];
      };
      mood_entries: {
        Row: MoodRow;
        Insert: Insert<MoodRow, 'id' | 'created_at' | 'logged_at' | 'logged_on'>;
        Update: Partial<MoodRow>;
        Relationships: [];
      };
      foods: {
        Row: FoodRow;
        Insert: Insert<
          FoodRow,
          'id' | 'created_at' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g'
          | 'sugar_g' | 'sodium_mg' | 'is_liquid' | 'is_public'
        >;
        Update: Partial<FoodRow>;
        Relationships: [];
      };
      food_entries: {
        Row: FoodEntryRow;
        // The nutrition snapshot is written by a database trigger, never by
        // the client — so it is optional on insert.
        Insert: Insert<
          FoodEntryRow,
          'id' | 'created_at' | 'logged_at' | 'logged_on' | 'food_name'
          | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'sugar_g' | 'sodium_mg'
        >;
        Update: Partial<FoodEntryRow>;
        Relationships: [];
      };
    };
    Views: {
      daily_nutrition: {
        Row: Omit<DailySummaryRow, 'water_ml' | 'sleep_min' | 'steps' | 'mood_avg' | 'weight_kg'> & {
          sugar_mg?: number;
          entry_count: number;
        };
        Relationships: [];
      };
      daily_summary: {
        Row: DailySummaryRow;
        Relationships: [];
      };
    };
    Functions: {
      search_foods: {
        Args: { query: string; max_results?: number };
        Returns: FoodRow[];
      };
    };
    Enums: {
      sex_type: SexType;
      activity_level: ActivityLevelType;
      goal_type: GoalType;
      meal_type: MealTypeDb;
    };
    CompositeTypes: Record<never, never>;
  };
}
