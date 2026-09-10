import { onboardingSchema } from './schemas';

/**
 * The first-login setup, split into three steps.
 *
 * Shared between web and mobile for the same reason the tutorial copy is: two
 * apps, one thing to ask. Kept apart, the steps drift — the phone asks for
 * weight in step two while the web asks in step three, and a bug reported
 * against "langkah 2" then means two different screens.
 *
 * Why three, and why in this order:
 *
 *   1. Identitas  — who you are. Cheapest to answer, nothing to look up, so it
 *                   is the least likely place to abandon the form.
 *   2. Tubuh      — height and weight. These are the two numbers people may
 *                   have to go and check, so they get a step of their own
 *                   rather than being buried among radio buttons.
 *   3. Target     — activity and goal, with the calculated targets shown live.
 *                   Last because it is the only step whose answer visibly
 *                   changes the numbers, which is a good note to end on.
 *
 * The split is presentational. `onboardingSchema` still validates the whole
 * thing on submit, so a field cannot be skipped by jumping steps.
 */

/** Which fields belong to which step — the source of per-step validation. */
export const ONBOARDING_STEP_FIELDS = {
  identity: ['fullName', 'birthDate', 'sex'],
  body: ['heightCm', 'weightKg'],
  targets: ['activityLevel', 'goal'],
} as const satisfies Record<string, readonly (keyof typeof onboardingSchema.shape)[]>;

export type OnboardingStepId = keyof typeof ONBOARDING_STEP_FIELDS;

export interface OnboardingStep {
  id: OnboardingStepId;
  /** Shown in the progress header. Two words at most. */
  label: string;
  title: string;
  hint: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'identity',
    label: 'Identitas',
    title: 'Kenalan dulu',
    hint: 'Nama untuk sapaan, tanggal lahir dan jenis kelamin untuk menghitung kebutuhan kalorimu.',
  },
  {
    id: 'body',
    label: 'Tubuh',
    title: 'Tinggi dan berat',
    hint: 'Dua angka ini yang paling menentukan targetmu. Perkiraan pun tidak masalah — bisa diperbarui kapan saja.',
  },
  {
    id: 'targets',
    label: 'Target',
    title: 'Seberapa aktif, dan mau ke mana',
    hint: 'Dari sini targetnya dihitung. Angkanya langsung terlihat di bawah sebelum kamu simpan.',
  },
] as const;

export function validateOnboardingStep(
  step: OnboardingStepId,
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of ONBOARDING_STEP_FIELDS[step]) {
    const result = onboardingSchema.shape[field].safeParse(values[field]);
    if (!result.success) {
      errors[field] = result.error.issues[0]?.message ?? 'Nilai tidak valid';
    }
  }

  return errors;
}
