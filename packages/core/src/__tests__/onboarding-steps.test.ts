import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_FIELDS,
  validateOnboardingStep,
} from '../onboarding-steps';
import { onboardingSchema } from '../schemas';

const VALID = {
  fullName: 'Aulia',
  birthDate: '1996-04-12',
  sex: 'male',
  heightCm: 172,
  weightKg: 68,
  activityLevel: 'moderate',
  goal: 'lose',
  timezone: 'Asia/Jakarta',
};

describe('onboarding steps', () => {
  it('covers every field the schema requires, exactly once', () => {
    // The point of this test: a field added to the schema but forgotten in the
    // step map would be unreachable in the UI, and the user would be stopped
    // on submit by an error about a field no screen ever showed them.
    const stepped = Object.values(ONBOARDING_STEP_FIELDS).flat().sort();
    const required = Object.keys(onboardingSchema.shape)
      // timezone is read from the device, never asked.
      .filter((field) => field !== 'timezone')
      .sort();

    expect(stepped).toEqual(required);
    expect(new Set(stepped).size).toBe(stepped.length);
  });

  it('has one step definition per group of fields, in order', () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual(
      Object.keys(ONBOARDING_STEP_FIELDS),
    );
  });

  it('passes a complete step', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(validateOnboardingStep(step.id, VALID)).toEqual({});
    }
  });

  it('reports only the failing field of the step being checked', () => {
    const errors = validateOnboardingStep('identity', { ...VALID, fullName: '  ' });
    expect(Object.keys(errors)).toEqual(['fullName']);
    expect(errors['fullName']).toMatch(/kosong/i);
  });

  it('does not complain about a later step while on an earlier one', () => {
    // Height is blank because the user has not reached that step yet; the
    // identity step must not block on it.
    const errors = validateOnboardingStep('identity', { ...VALID, heightCm: '' });
    expect(errors).toEqual({});
  });

  it('rejects an impossible age with the schema wording', () => {
    const errors = validateOnboardingStep('identity', {
      ...VALID,
      birthDate: '2024-01-01',
    });
    expect(errors['birthDate']).toMatch(/13 dan 120/);
  });

  it('rejects out-of-range body values', () => {
    expect(validateOnboardingStep('body', { ...VALID, heightCm: 40 })['heightCm']).toMatch(
      /80 cm/,
    );
    expect(validateOnboardingStep('body', { ...VALID, weightKg: 5 })['weightKg']).toMatch(
      /20 kg/,
    );
  });
});
