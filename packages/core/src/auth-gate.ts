/**
 * Where a person belongs right now, given what their account has finished.
 *
 * This is the whole register/login flow expressed as one function, on purpose.
 * It used to be an `if` ladder written twice — once in the Next.js app shell,
 * once in the expo-router root layout — and the two drifted within days: the
 * phone would send someone to the intro that the web had already marked as
 * seen. Rules that must agree across platforms belong in one place that both
 * import, and that a test can pin down.
 *
 * The flow it encodes:
 *
 *   1. Not signed in            → /login
 *   2. Signed in, no profile    → /onboarding   (setup first, always)
 *   3. Profile done, no intro   → /tutorial
 *   4. Both done                → the app
 *
 * Rule 2 is what makes a returning user's experience correct: `onboarded` is
 * a stored fact, so once setup is finished it is never asked for again — not
 * on the next login, not on the other platform.
 */

/** The routes the gate can send someone to. `null` means "stay put". */
export type GateRoute = '/login' | '/onboarding' | '/tutorial' | '/app' | null;

export interface GateState {
  signedIn: boolean;
  /** Has this account finished the profile setup? `null` = not asked yet. */
  onboarded: boolean | null;
  /** Has this account finished or skipped the intro? `null` = not asked yet. */
  tutorialSeen: boolean | null;
  /** Which of the gate's own screens the person is on, if any. */
  at: 'login' | 'onboarding' | 'tutorial' | 'app';
}

export function nextRoute(state: GateState): GateRoute {
  const { signedIn, onboarded, tutorialSeen, at } = state;

  if (!signedIn) return at === 'login' ? null : '/login';

  /*
   * Not knowing yet is NOT the same as "no".
   *
   * Treating an unanswered lookup as `false` shows the setup form to someone
   * who finished it months ago, for the half-second before the answer lands —
   * and on a slow connection, for much longer than that. Waiting is the only
   * safe reading.
   */
  if (onboarded === null || tutorialSeen === null) return null;

  if (!onboarded) return at === 'onboarding' ? null : '/onboarding';
  if (!tutorialSeen) return at === 'tutorial' ? null : '/tutorial';

  // Everything done. Only move people who are still standing on a gate screen;
  // someone already inside the app must not be bounced to its root on every
  // navigation.
  return at === 'app' ? null : '/app';
}
