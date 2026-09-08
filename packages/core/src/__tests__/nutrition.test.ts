import { describe, expect, it } from 'vitest';
import {
  bmr,
  calorieTarget,
  defaultPortionG,
  deriveTargets,
  kcalFromMacros,
  macroSplit,
  macroTargets,
  mealForHour,
  nutrientsForQuantity,
  sumNutrients,
  tdee,
  waterTarget,
} from '../nutrition';
import type { Nutrients } from '../types';

describe('bmr (Mifflin-St Jeor)', () => {
  it('matches the published formula for men', () => {
    // 10*80 + 6.25*178 - 5*30 + 5 = 1767.5
    expect(bmr({ sex: 'male', weightKg: 80, heightCm: 178, ageYears: 30 })).toBe(1768);
  });

  it('matches the published formula for women', () => {
    // 10*60 + 6.25*165 - 5*28 - 161 = 1330.25
    expect(bmr({ sex: 'female', weightKg: 60, heightCm: 165, ageYears: 28 })).toBe(1330);
  });

  it('is monotonic in weight', () => {
    const light = bmr({ sex: 'female', weightKg: 55, heightCm: 165, ageYears: 30 });
    const heavy = bmr({ sex: 'female', weightKg: 75, heightCm: 165, ageYears: 30 });
    expect(heavy).toBeGreaterThan(light);
  });
});

describe('tdee', () => {
  it('applies the activity multiplier', () => {
    const stats = { sex: 'male', weightKg: 80, heightCm: 178, ageYears: 30 } as const;
    expect(tdee(stats, 'moderate')).toBe(Math.round(1768 * 1.55));
  });

  it('increases with activity level', () => {
    const stats = { sex: 'female', weightKg: 60, heightCm: 165, ageYears: 28 } as const;
    expect(tdee(stats, 'very_active')).toBeGreaterThan(tdee(stats, 'sedentary'));
  });
});

describe('calorieTarget', () => {
  it('cuts 20% for fat loss and rounds to 10', () => {
    expect(calorieTarget(2740, 'lose', 'male')).toBe(2190);
  });

  it('adds 12% for lean gain', () => {
    expect(calorieTarget(2000, 'gain', 'male')).toBe(2240);
  });

  it('leaves maintenance alone', () => {
    expect(calorieTarget(2000, 'maintain', 'female')).toBe(2000);
  });

  it('never dips below the safe floor', () => {
    // A very small person on a deficit would otherwise land near 900 kcal.
    expect(calorieTarget(1300, 'lose', 'female')).toBe(1200);
    expect(calorieTarget(1400, 'lose', 'male')).toBe(1500);
  });
});

describe('macroTargets', () => {
  it('anchors protein to bodyweight', () => {
    const macros = macroTargets(2190, 80, 'lose');
    expect(macros.proteinG).toBe(160); // 2.0 g/kg
    expect(macros.fatG).toBe(61); // 25% of kcal / 9
    expect(macros.carbsG).toBe(250);
    expect(macros.fiberG).toBe(31); // 14 g per 1000 kcal
  });

  it('caps protein at 40% of calories for heavy users on a deep cut', () => {
    const macros = macroTargets(1500, 120, 'lose');
    expect(macros.proteinG).toBe(150); // capped, not 240
    expect(macros.carbsG).toBeGreaterThanOrEqual(0);
  });

  it('never produces negative carbs', () => {
    const macros = macroTargets(1200, 150, 'lose');
    expect(macros.carbsG).toBeGreaterThanOrEqual(0);
  });

  it('roughly reconstructs the calorie budget', () => {
    const kcal = 2200;
    const macros = macroTargets(kcal, 75, 'maintain');
    expect(Math.abs(kcalFromMacros(macros) - kcal)).toBeLessThanOrEqual(10);
  });
});

describe('waterTarget', () => {
  it('uses 35 ml/kg plus an activity bonus', () => {
    expect(waterTarget(80, 'moderate')).toBe(3300);
  });

  it('clamps to a sane range', () => {
    expect(waterTarget(30, 'sedentary')).toBe(1500);
    expect(waterTarget(200, 'very_active')).toBe(4000);
  });
});

describe('deriveTargets', () => {
  it('produces a complete, plausible target set', () => {
    const targets = deriveTargets(
      { sex: 'female', weightKg: 60, heightCm: 165, ageYears: 28 },
      'light',
      'lose',
    );
    expect(targets.kcal).toBeGreaterThanOrEqual(1200);
    expect(targets.proteinG).toBeGreaterThan(0);
    expect(targets.waterMl).toBeGreaterThanOrEqual(1500);
    expect(targets.sleepMin).toBe(480);
    expect(targets.steps).toBe(8000);
  });
});

describe('portion maths', () => {
  const nasi: Nutrients = {
    kcal: 130,
    proteinG: 2.7,
    carbsG: 28.2,
    fatG: 0.3,
    fiberG: 0.4,
    sugarG: 0.1,
    sodiumMg: 1,
  };

  it('scales per-100 g values to the portion', () => {
    const portion = nutrientsForQuantity(nasi, 150);
    expect(portion.kcal).toBe(195);
    expect(portion.carbsG).toBe(42.3);
  });

  it('returns zeros for a zero portion', () => {
    expect(nutrientsForQuantity(nasi, 0).kcal).toBe(0);
  });

  it('rejects negative portions', () => {
    expect(() => nutrientsForQuantity(nasi, -1)).toThrow(RangeError);
  });

  it('sums a day of entries', () => {
    const total = sumNutrients([
      nutrientsForQuantity(nasi, 100),
      nutrientsForQuantity(nasi, 200),
    ]);
    expect(total.kcal).toBeCloseTo(390, 5);
  });

  it('sums to zero for an empty day', () => {
    expect(sumNutrients([]).kcal).toBe(0);
  });

  it('splits calories across macros', () => {
    const split = macroSplit({ proteinG: 150, carbsG: 200, fatG: 60 });
    expect(split.protein + split.carbs + split.fat).toBeGreaterThanOrEqual(99);
    expect(split.protein + split.carbs + split.fat).toBeLessThanOrEqual(101);
  });

  it('handles an empty macro split without dividing by zero', () => {
    expect(macroSplit({ proteinG: 0, carbsG: 0, fatG: 0 })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it('prefers a stated serving size as the default portion', () => {
    expect(defaultPortionG({ servingG: 118 })).toBe(118);
    expect(defaultPortionG({ servingG: null })).toBe(100);
  });
});

describe('mealForHour', () => {
  it('maps the day to the meal people are actually eating', () => {
    expect(mealForHour(7)).toBe('breakfast');
    expect(mealForHour(12)).toBe('lunch');
    expect(mealForHour(19)).toBe('dinner');
    expect(mealForHour(22)).toBe('snack');
  });

  it('treats the small hours as a snack, not breakfast', () => {
    // 02:00 is someone finishing yesterday, not starting today.
    expect(mealForHour(0)).toBe('snack');
    expect(mealForHour(3)).toBe('snack');
    expect(mealForHour(4)).toBe('breakfast');
  });

  it('keeps early afternoon on lunch', () => {
    // The boundary that matters most in practice: 14:00 is late lunch.
    expect(mealForHour(14)).toBe('lunch');
    expect(mealForHour(15)).toBe('dinner');
  });

  it('covers every hour of the day', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(['breakfast', 'lunch', 'dinner', 'snack']).toContain(mealForHour(hour));
    }
  });
});
