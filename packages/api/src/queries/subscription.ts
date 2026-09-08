import type { PlanTier } from '@calorya/core';
import { requireUserId, unwrapMaybe, type CaloryaClient } from '../client';

/**
 * Reading the user's plan.
 *
 * Nothing here grants anything: the history window is imposed by RLS. These
 * queries only let the interface tell the truth about what the user has.
 */

export interface Subscription {
  tier: PlanTier;
  status: string;
  currentPeriodEnd: string | null;
  provider: string | null;
}

export async function getSubscription(
  client: CaloryaClient,
): Promise<Subscription | null> {
  const userId = await requireUserId(client);
  const row = unwrapMaybe(
    await client
      .from('subscriptions')
      .select('tier, status, current_period_end, provider')
      .eq('user_id', userId)
      .maybeSingle(),
    'getSubscription',
  );
  if (!row) return null;

  return {
    tier: row.tier,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    provider: row.provider,
  };
}

/**
 * The effective tier, asked of the database rather than derived in JS.
 *
 * current_tier() is the same function the RLS policies call, so the UI can
 * never disagree with what the user is actually allowed to read — including
 * the lapsed and cancelled cases, which a naive `tier === 'premium'` check on
 * the row would get wrong, and including the paywall switch, which makes this
 * answer 'premium' for everyone while it is off. Reading the subscription row
 * instead of asking this function would get all three wrong.
 *
 * Falls back to 'free' if the call fails: a network hiccup must not hand out
 * premium.
 */
export async function getTier(client: CaloryaClient): Promise<PlanTier> {
  const { data, error } = await client.rpc('current_tier');
  if (error || !data) return 'free';
  return data;
}
