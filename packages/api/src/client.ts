import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * The one client type the whole app agrees on. Each platform constructs it
 * differently — cookie-backed on the Next.js server, localStorage in the
 * browser, AsyncStorage in Expo — but every query below is platform-agnostic.
 */
export type CaloryaClient = SupabaseClient<Database>;

/** A failed query, with enough context to be actionable in a log. */
export class CaloryaApiError extends Error {
  readonly code: string | undefined;
  readonly details: string | undefined;
  readonly operation: string;

  constructor(operation: string, cause: PostgrestError) {
    super(`${operation}: ${cause.message}`);
    this.name = 'CaloryaApiError';
    this.operation = operation;
    this.code = cause.code;
    this.details = cause.details;
  }
}

/**
 * Throw on error, return data otherwise.
 *
 * Supabase returns `{ data, error }` rather than rejecting, which makes it
 * very easy to render `undefined` into the UI after a failed request. Funnel
 * every call through here so a failure is always loud.
 */
export function unwrap<T>(
  result: { data: T; error: PostgrestError | null },
  operation: string,
): NonNullable<T> {
  if (result.error) throw new CaloryaApiError(operation, result.error);
  if (result.data === null || result.data === undefined) {
    throw new Error(`${operation}: expected data but received null`);
  }
  return result.data as NonNullable<T>;
}

/** Same, but a missing row is a legitimate answer rather than a failure. */
export function unwrapMaybe<T>(
  result: { data: T; error: PostgrestError | null },
  operation: string,
): T | null {
  if (result.error) {
    // PGRST116 = "no rows returned" from .single(); that is not an error here.
    if (result.error.code === 'PGRST116') return null;
    throw new CaloryaApiError(operation, result.error);
  }
  return result.data;
}

/** Current user id, or null when signed out. */
export async function currentUserId(client: CaloryaClient): Promise<string | null> {
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

/** Current user id, or throw — for code paths that are already behind a guard. */
export async function requireUserId(client: CaloryaClient): Promise<string> {
  const id = await currentUserId(client);
  if (!id) throw new Error('Not authenticated');
  return id;
}
