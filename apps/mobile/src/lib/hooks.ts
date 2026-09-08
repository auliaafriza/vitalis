import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addFoodEntry,
  addWater,
  deleteFoodEntry,
  getAllDaySummaries,
  getDaySummaries,
  getDaySummary,
  getFoodEntries,
  getProfile,
  getTargetsFor,
  getTier,
  recentFoods,
  resolveBarcode,
  searchFoods,
  upsertSleep,
  upsertSteps,
  upsertWeight,
} from '@calorya/api';
import type {
  FoodCategory,
  FoodEntryInput,
  SleepEntryInput,
  StepEntryInput,
  WaterEntryInput,
  WeightEntryInput,
} from '@calorya/core';
import { getClient } from './supabase';

/**
 * The mobile hooks mirror the web ones deliberately: same query keys, same
 * invalidation rules, different client. Because the queries themselves live
 * in @calorya/api, this file contains no data logic at all — only wiring.
 */
export const qk = {
  profile: ['profile'] as const,
  tier: ['tier'] as const,
  allSummaries: ['summaries', 'all'] as const,
  targets: (day: string) => ['targets', day] as const,
  summary: (day: string) => ['summary', day] as const,
  summaries: (from: string, to: string) => ['summaries', from, to] as const,
  foodEntries: (day: string) => ['food-entries', day] as const,
  foodSearch: (q: string, category: FoodCategory | null) =>
    ['food-search', q, category] as const,
  recentFoods: ['recent-foods'] as const,
};

export function useProfile() {
  return useQuery({ queryKey: qk.profile, queryFn: () => getProfile(getClient()) });
}

/**
 * The plan the database will actually honour — current_tier() is the same
 * function the RLS policies call, so the screens can never promise more
 * history than the server will return, and turning the paywall off
 * (app_settings.paywall_enabled) unlocks them with no change here.
 *
 * Defaults to free while it loads and on any error, so a flaky connection
 * never unlocks anything. `initialDataUpdatedAt: 0` marks that seed stale
 * immediately — otherwise react-query would treat it as fresh and skip the
 * fetch for the whole staleTime, leaving a premium user behind padlocks for a
 * minute after every mount.
 */
export function useTier() {
  return useQuery({
    queryKey: qk.tier,
    queryFn: () => getTier(getClient()),
    staleTime: 60_000,
    initialData: 'free' as const,
    initialDataUpdatedAt: 0,
  });
}

/** Whatever history the window allows — used for the "Semua" range. */
export function useAllDaySummaries(enabled = true) {
  return useQuery({
    queryKey: qk.allSummaries,
    queryFn: () => getAllDaySummaries(getClient()),
    enabled,
  });
}

export function useTargets(day: string) {
  return useQuery({
    queryKey: qk.targets(day),
    queryFn: () => getTargetsFor(getClient(), day),
  });
}

export function useDaySummary(day: string) {
  return useQuery({
    queryKey: qk.summary(day),
    queryFn: () => getDaySummary(getClient(), day),
  });
}

export function useDaySummaries(from: string, to: string) {
  return useQuery({
    queryKey: qk.summaries(from, to),
    queryFn: () => getDaySummaries(getClient(), from, to),
  });
}

export function useFoodEntries(day: string) {
  return useQuery({
    queryKey: qk.foodEntries(day),
    queryFn: () => getFoodEntries(getClient(), day),
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
    queryFn: () => searchFoods(getClient(), trimmed, 30, category ?? undefined),
    staleTime: 5 * 60_000,
  });
}

export function useRecentFoods() {
  return useQuery({
    queryKey: qk.recentFoods,
    queryFn: () => recentFoods(getClient(), 8),
    staleTime: 5 * 60_000,
  });
}

function useDayInvalidator(day: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.summary(day) });
    void client.invalidateQueries({ queryKey: ['summaries'] });
    void client.invalidateQueries({ queryKey: qk.foodEntries(day) });
    void client.invalidateQueries({ queryKey: qk.recentFoods });
  };
}

export function useResolveBarcode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (barcode: string) => resolveBarcode(getClient(), barcode),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['food-search'] });
      void client.invalidateQueries({ queryKey: qk.recentFoods });
    },
  });
}

export function useAddFood(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (input: FoodEntryInput) => addFoodEntry(getClient(), input),
    onSuccess: invalidate,
  });
}

export function useDeleteFood(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (id: string) => deleteFoodEntry(getClient(), id),
    onSuccess: invalidate,
  });
}

export function useAddWater(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (input: WaterEntryInput) => addWater(getClient(), input),
    onSuccess: invalidate,
  });
}

export function useSaveWeight(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (input: WeightEntryInput) => upsertWeight(getClient(), input),
    onSuccess: invalidate,
  });
}

export function useSaveSleep(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (input: SleepEntryInput) => upsertSleep(getClient(), input),
    onSuccess: invalidate,
  });
}

export function useSaveSteps(day: string) {
  const invalidate = useDayInvalidator(day);
  return useMutation({
    mutationFn: (input: StepEntryInput) => upsertSteps(getClient(), input),
    onSuccess: invalidate,
  });
}
