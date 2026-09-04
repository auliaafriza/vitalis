'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addFoodEntry,
  addMood,
  addWater,
  deleteFoodEntry,
  deleteWater,
  getDaySummaries,
  getDaySummary,
  getFoodEntries,
  getLatestWeight,
  getProfile,
  getSleep,
  getSteps,
  getTargetsFor,
  getWaterEntries,
  getWeightEntries,
  listFoods,
  recentFoods,
  resolveBarcode,
  searchFoods,
  upsertSleep,
  upsertSteps,
  upsertWeight,
} from '@calorya/api';
import type {
  FoodEntryInput,
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
  targets: (day: string) => ['targets', day] as const,
  summary: (day: string) => ['summary', day] as const,
  summaries: (from: string, to: string) => ['summaries', from, to] as const,
  foodEntries: (day: string) => ['food-entries', day] as const,
  water: (day: string) => ['water', day] as const,
  sleep: (day: string) => ['sleep', day] as const,
  steps: (day: string) => ['steps', day] as const,
  weights: (from: string, to: string) => ['weights', from, to] as const,
  latestWeight: ['latest-weight'] as const,
  foodSearch: (q: string) => ['food-search', q] as const,
  recentFoods: ['recent-foods'] as const,
};

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

/** Empty query shows the catalogue; otherwise ranked full-text search. */
export function useFoodSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: qk.foodSearch(trimmed),
    queryFn: () =>
      trimmed.length === 0
        ? listFoods(getBrowserClient(), 30)
        : searchFoods(getBrowserClient(), trimmed, 30),
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
