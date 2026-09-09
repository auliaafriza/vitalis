/**
 * Where the web app lives.
 *
 * The mobile app needs this for two things it cannot serve itself: the email
 * confirmation link (Supabase sends the user to a web page, not into the APK)
 * and the privacy policy that Google Play links to.
 *
 * It is an environment variable rather than a constant because the value
 * differs per build profile and because a hard-coded domain is exactly the
 * kind of thing that stays wrong for months — set EXPO_PUBLIC_SITE_URL in
 * eas.json, next to the Supabase keys.
 *
 * Deliberately `null` when unset instead of falling back to a guess: a missing
 * link is a visible problem, a wrong one is a silent one. Every caller has to
 * handle the null, which is the point.
 */
const raw = process.env.EXPO_PUBLIC_SITE_URL?.trim();

export const SITE_URL: string | null =
  raw && raw.startsWith('http') ? raw.replace(/\/+$/, '') : null;

if (__DEV__ && !SITE_URL) {
  console.warn(
    '[calorya] EXPO_PUBLIC_SITE_URL belum di-set. Tautan konfirmasi email akan ' +
      'memakai Site URL dari dashboard Supabase, dan tautan kebijakan privasi ' +
      'disembunyikan.',
  );
}

/** The page Supabase sends people to after they click the confirmation email. */
export const authCallbackUrl = (): string | null =>
  SITE_URL ? `${SITE_URL}/auth/callback` : null;

export const privacyUrl = (): string | null => (SITE_URL ? `${SITE_URL}/privasi` : null);
