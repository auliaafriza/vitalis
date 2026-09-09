'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addFoodEntry,
  addMood,
  addWater,
  copyMeal,
  deleteFoodEntry,
  deleteWater,
  getAllDaySummaries,
  getDaySummaries,
  getDaySummary,
  getFoodEntriesRange,
  getFoodEntries,
  getLatestWeight,
  getProfile,
  getSleep,
  getSteps,
  getTargetsFor,
  getTier,
  getWaterEntries,
  getWeightEntries,
  recentFoods,
  resolveBarcode,
  searchFoods,
  updateFoodEntryQuantity,
  upsertSleep,
  upsertSteps,
  upsertWeight,
} from '@calorya/api';
import type {
  FoodCategory,
  FoodEntryInput,
  MealType,
  MoodEntryInput,
  SleepEntryInput,
  StepEntryInput,
  WaterEntryInput,
  WeightEntryInput,
} from '@calorya/core';
import { getBrowserClient } from './supabase/client';

/**
 * Query keys are namespaced by day so that logging a glass of water
 * invalidates today's rollup without throwing away last month's chart data.
 */
export const qk = {
  profile: ['profile'] as const,
  tier: ['tier'] as const,
  allSummaries: ['summaries', 'all'] as const,
  entriesRange: (from: string, to: string) => ['entries-range', from, to] as const,
  targets: (day: string) => ['targets', day] as const,
  summary: (day: string) => ['summary', day] as const,
  summaries: (from: string, to: string) => ['summaries', from, to] as const,
  foodEntries: (day: string) => ['food-entries', day] as const,
  water: (day: string) => ['water', day] as const,
  sleep: (day: string) => ['sleep', day] as const,
  steps: (day: string) => ['steps', day] as const,
  weights: (from: string, to: string) => ['weights', from, to] as const,
  latestWeight: ['latest-weight'] as const,
  foodSearch: (q: string, category: FoodCategory | null) =>
    ['food-search', q, category] as const,
  recentFoods: ['recent-foods'] as const,
};

/**
 * The plan the database will actually honour.
 *
 * Asked of current_tier() — the same function the RLS policies call — so the
 * UI can never claim more than the user can read, and so that turning the
 * paywall off (app_settings.paywall_enabled) unlocks the interface without a
 * single change here.
 *
 * `initialDataUpdatedAt: 0` is load-bearing: without it react-query treats the
 * seeded 'free' as fresh and skips the fetch for the whole staleTime, so a
 * premium user would sit behind padlocks for a minute after every mount.
 * Dating the seed to the epoch marks it stale immediately, so it is only ever
 * the value shown for the first render.
 */
export function useTier() {
  return useQuery({
    queryKey: qk.tier,
    queryFn: () => getTier(getBrowserClient()),
    staleTime: 60_000,
    initialData: 'free' as const,
    initialDataUpdatedAt: 0,
  });
}

/** Whatever history the window allows — used for the "Semua" range and export. */
export function useAllDaySummaries(enabled = true) {
  return useQuery({
    queryKey: qk.allSummaries,
    queryFn: () => getAllDaySummaries(getBrowserClient()),
    enabled,
  });
}

export function useFoodEntriesRange(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: qk.entriesRange(from, to),
    queryFn: () => getFoodEntriesRange(getBrowserClient(), from, to),
    enabled,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: qk.profile,
    queryFn: () => getProfile(getBrowserClient()),
  });
}

export function useTargets(day: string) {
  return useQuery({
    queryKey: qk.targets(day),
    queryFn: () => getTargetsFor(getBrowserClient(), day),
  });
}

export function useDaySummary(day: string) {
  return useQuery({
    queryKey: qk.summary(day),
    queryFn: () => getDaySummary(getBrowserClient(), day),
  });
}

export function useDaySummaries(from: string, to: string) {
  return useQuery({
    queryKey: qk.summaries(from, to),
    queryFn: () => getDaySummaries(getBrowserClient(), from, to),
  });
}

export function useFoodEntries(day: string) {
  return useQuery({
    queryKey: qk.foodEntries(day),
    queryFn: () => getFoodEntries(getBrowserClient(), day),
  });
}

export function useWaterEntries(day: string) {
  return useQuery({
    queryKey: qk.water(day),
    queryFn: () => getWaterEntries(getBrowserClient(), day),
  });
}

export function useSleep(day: string) {
  return useQuery({
    queryKey: qk.sleep(day),
    queryFn: () => getSleep(getBrowserClient(), day),
  });
}

export function useSteps(day: string) {
  return useQuery({
    queryKey: qk.steps(day),
    queryFn: () => getSteps(getBrowserClient(), day),
  });
}

export function useWeights(from: string, to: string) {
  return useQuery({
    queryKey: qk.weights(from, to),
    queryFn: () => getWeightEntries(getBrowserClient(), from, to),
  });
}

export function useLatestWeight() {
  return useQuery({
    queryKey: qk.latestWeight,
    queryFn: () => getLatestWeight(getBrowserClient()),
  });
}

/**
 * Empty query shows the catalogue; otherwise ranked full-text search.
 * A category narrows either one — browsing a tile and typing are the same
 * query with different arguments, so they can never disagree about what
 * exists.
 */
export function useFoodSearch(query: string, category?: FoodCategory | null) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: qk.foodSearch(trimmed, category ?? null),
    queryFn: () => searchFoods(getBrowserClient(), trimmed, 30, category ?? undefined),
    staleTime: 5 * 60_000,
  });
}

export function useRecentFoods() {
  return useQuery({
    queryKey: qk.recentFoods,
    queryFn: () => recentFoods(getBrowserClient(), 8),
    staleTime: 5 * 60_000,
  });
}

/** Invalidate every view that a change to `day` could affect. */
function useDayInvalidator(day: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.summary(day) });
    void client.invalidateQueries({ queryKey: ['summaries'] });
    void client.invalidateQueries({ queryKey: qk.foodEntries(day) });
    void client.invalidateQueries({ queryKey: qk.water(day) });
    void client.invalidateQueries({ queryKey: qk.sleep(day) });
    void client.invalidateQueries({ queryKey: qk.steps(day) });
    void client.invalidateQueries({ queryKey: ['weights'] });
    void client.invalidateQueries({ queryKey: qk.latestWeight });
    void client.invalidateQueries({ queryKey: qk.recentFoods });
  };
}

/**
 * Resolve a scanned barcode: our catalogue first, then Open Food Facts.
 * A successful import adds a private food, so the search cache is stale after.
 */
export function useResolveBarcode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (barcode: string) => resolveBarcode(getBrowserClient(), barcode),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['food-search'] });
      void client.invalidateQueries({ queryKey: qk.recentFoods });
    },
  });
}

export function useAddFood(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (input: FoodEntryInput) => addFoodEntry(getBrowserClient(), input),
    onSuccess: invalidate,
  });
}

export function useDeleteFood(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (id: string) => deleteFoodEntry(getBrowserClient(), id),
    onSuccess: invalidate,
  });
}

/** Correcting a portion, rather than deleting and logging it again. */
export function useUpdateFoodQuantity(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: ({ id, quantityG }: { id: string; quantityG: number }) =>
      updateFoodEntryQuantity(getBrowserClient(), id, quantityG),
    onSuccess: invalidate,
  });
}

/**
 * Repeat a meal from another day.
 *
 * Copying by food id rather than by the stored snapshot means the copy uses
 * the food as it is defined now — and the returned array is empty when there
 * was nothing to copy, which the caller shows as a message rather than
 * pretending something happened.
 */
export function useCopyMeal(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: ({ from, meal }: { from: string; meal: MealType }) =>
      copyMeal(getBrowserClient(), from, day, meal),
    onSuccess: invalidate,
  });
}

export function useAddWater(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (input: WaterEntryInput) => addWater(getBrowserClient(), input),
    onSuccess: invalidate,
  });
}

export function useDeleteWater(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (id: string) => deleteWater(getBrowserClient(), id),
    onSuccess: invalidate,
  });
}

export function useSaveWeight(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (input: WeightEntryInput) => upsertWeight(getBrowserClient(), input),
    onSuccess: invalidate,
  });
}

export function useSaveSleep(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (input: SleepEntryInput) => upsertSleep(getBrowserClient(), input),
    onSuccess: invalidate,
  });
}

export function useSaveSteps(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (input: StepEntryInput) => upsertSteps(getBrowserClient(), input),
    onSuccess: invalidate,
  });
}

export function useAddMood(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (input: MoodEntryInput) => addMood(getBrowserClient(), input),
    onSuccess: invalidate,
  });
}
