/**
 * The half-finished setup form, kept across app restarts.
 *
 * Answering seven questions is not much, but it is enough that being
 * interrupted — a phone call, a battery warning, putting the phone down to go
 * and find the bathroom scales — should not cost the answers already given.
 * Without this, reopening the app shows an empty first step and the person
 * starts over, which is exactly when people give up on a signup.
 *
 * Deliberately NOT included: the optional new password. A password written to
 * disk in clear text, in a file that survives the app being closed, is a
 * genuine hazard — and the one field nobody minds retyping, because they were
 * about to type it fresh anyway.
 *
 * The draft carries the user id it belongs to. A phone that two people share,
 * or a device where one account signs out and another signs in, must not offer
 * the first person's height and birth date to the second.
 */

export const ONBOARDING_DRAFT_KEY = 'calorya.onboarding.draft.v1';

export interface OnboardingDraft {
  /** Whose draft this is. Restored only for a matching session. */
  userId: string;
  /** Which of the three steps they had reached. */
  step: number;
  fullName: string;
  birthDate: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  activityLevel: string;
  goal: string;
  /** When it was written, so a stale draft can be ignored. */
  savedAt: string;
}

/** A draft older than this is treated as abandoned rather than resumed. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Read a draft back, or `null` if there is nothing usable.
 *
 * Everything is checked rather than trusted: the value comes from device
 * storage, which can hold anything a previous version of the app wrote, and a
 * malformed draft must degrade to "start fresh" rather than to a crash on the
 * first screen after signing in.
 */
export function parseOnboardingDraft(
  raw: string | null | undefined,
  userId: string,
  now: number = Date.now(),
): OnboardingDraft | null {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null) return null;
  const d = value as Partial<OnboardingDraft>;

  if (d.userId !== userId) return null;

  const savedAt = d.savedAt ? Date.parse(d.savedAt) : NaN;
  if (!Number.isFinite(savedAt) || now - savedAt > MAX_AGE_MS) return null;

  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const step = typeof d.step === 'number' && d.step >= 0 && d.step <= 2 ? d.step : 0;

  return {
    userId,
    step,
    fullName: str(d.fullName),
    birthDate: str(d.birthDate),
    sex: str(d.sex),
    heightCm: str(d.heightCm),
    weightKg: str(d.weightKg),
    activityLevel: str(d.activityLevel),
    goal: str(d.goal),
    savedAt: str(d.savedAt),
  };
}

/** Serialise a draft for storage. Stamps `savedAt` so age can be judged later. */
export function serialiseOnboardingDraft(
  draft: Omit<OnboardingDraft, 'savedAt'>,
): string {
  return JSON.stringify({ ...draft, savedAt: new Date().toISOString() });
}
