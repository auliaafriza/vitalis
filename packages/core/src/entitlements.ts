/**
 * What each plan is allowed to do.
 *
 * This is the single source of truth the UI reads, but it is NOT what enforces
 * anything: the history window is imposed by Row-Level Security in
 * supabase/migrations/20260907000000_entitlements.sql. These values exist so
 * the interface can explain the limit before the user hits it — the numbers
 * here and the numbers in the policy must be kept in step deliberately.
 *
 * Note that the paywall currently ships SWITCHED OFF
 * (app_settings.paywall_enabled, migration 20260908000000), which makes
 * current_tier() answer 'premium' for everyone. Nothing below is dead code:
 * the tier simply arrives as premium, so `limitsFor` returns the unlimited
 * row and no padlock is ever rendered. Turning the switch back on is the only
 * thing needed to make these limits bite again.
 */

export type PlanTier = 'free' | 'premium';

/** `null` means unlimited. */
export interface TierLimits {
  /** How many days of history the trends screen may request. */
  historyDays: number | null;
  /** CSV and printable report. */
  canExport: boolean;
  /** Body measurements, body-fat percentage, progress photos. */
  canTrackBody: boolean;
  /** Foods the user may define themselves. */
  customFoods: number | null;
}

export const LIMITS: Record<PlanTier, TierLimits> = {
  free: {
    historyDays: 7,
    canExport: false,
    canTrackBody: false,
    customFoods: 15,
  },
  premium: {
    historyDays: null,
    canExport: true,
    canTrackBody: true,
    customFoods: null,
  },
};

/** `null` days means "everything on record". */
export interface TrendRange {
  days: number | null;
  label: string;
}

export const TREND_RANGES: readonly TrendRange[] = [
  { days: 7, label: '7 hari' },
  { days: 30, label: '30 hari' },
  { days: 90, label: '90 hari' },
  { days: 365, label: '1 tahun' },
  { days: null, label: 'Semua' },
] as const;

export function limitsFor(tier: PlanTier): TierLimits {
  return LIMITS[tier];
}

/** Can this tier ask for a window of `days` (null = all history)? */
export function isRangeAllowed(tier: PlanTier, days: number | null): boolean {
  const max = LIMITS[tier].historyDays;
  if (max === null) return true;
  if (days === null) return false;
  return days <= max;
}

export function allowedRanges(tier: PlanTier): TrendRange[] {
  return TREND_RANGES.filter((range) => isRangeAllowed(tier, range.days));
}

export function lockedRanges(tier: PlanTier): TrendRange[] {
  return TREND_RANGES.filter((range) => !isRangeAllowed(tier, range.days));
}

/**
 * The widest range this tier may use — what to fall back to when a premium
 * user's subscription lapses while they are looking at a 365-day chart.
 */
export function widestAllowedRange(tier: PlanTier): TrendRange {
  const allowed = allowedRanges(tier);
  return allowed[allowed.length - 1] ?? TREND_RANGES[0]!;
}

/**
 * Clamp a requested window to what the tier may have.
 * Returns the days to actually request, so a stale UI selection degrades
 * instead of producing an empty chart.
 */
export function clampRange(tier: PlanTier, days: number | null): number | null {
  return isRangeAllowed(tier, days) ? days : widestAllowedRange(tier).days;
}

export function isPremium(tier: PlanTier): boolean {
  return tier === 'premium';
}
