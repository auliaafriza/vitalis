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
  targetsEqual,
  tdee,
  trendWeightKg,
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
    expect(macros.fiberG).toBe(35); // 16 g per 1000 kcal on a cut
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

  it('defaults to the maintenance figure when no goal is given', () => {
    // Older two-argument callers must keep the number they had.
    expect(waterTarget(80, 'moderate')).toBe(waterTarget(80, 'moderate', 'maintain'));
  });

  it('asks for more water on either side of maintenance', () => {
    // A deficit means more protein to excrete and more hunger to blunt; a
    // surplus means more food to digest and more glycogen storing water.
    expect(waterTarget(70, 'light', 'lose')).toBeGreaterThan(
      waterTarget(70, 'light', 'maintain'),
    );
    expect(waterTarget(70, 'light', 'gain')).toBeGreaterThan(
      waterTarget(70, 'light', 'maintain'),
    );
    expect(waterTarget(70, 'light', 'lose')).toBeGreaterThan(
      waterTarget(70, 'light', 'gain'),
    );
  });

  it('still refuses to tell anyone to drink more than 4 L', () => {
    expect(waterTarget(200, 'very_active', 'lose')).toBe(4000);
  });
});

/**
 * The three goals, compared side by side.
 *
 * Each target is checked against the *other two*, not against a hard-coded
 * number, so the suite defends the shape of the advice rather than one
 * particular tuning. If someone later decides the deficit should be 18% rather
 * than 20%, these stay green; if someone accidentally makes a cut recommend
 * more calories than a bulk, they do not.
 */
describe('targets across goals', () => {
  const stats = {
    sex: 'male',
    weightKg: 80,
    heightCm: 178,
    ageYears: 30,
  } as const;
  const forGoal = (goal: 'lose' | 'maintain' | 'gain') =>
    deriveTargets(stats, 'moderate', goal);

  const lose = forGoal('lose');
  const maintain = forGoal('maintain');
  const gain = forGoal('gain');

  it('orders calories cut < maintain < gain', () => {
    expect(lose.kcal).toBeLessThan(maintain.kcal);
    expect(gain.kcal).toBeGreaterThan(maintain.kcal);
  });

  it('gives the most protein to the cut, the least to maintenance', () => {
    // Protein is anchored to bodyweight, so it does NOT follow calories: the
    // smallest budget gets the largest protein target, on purpose.
    expect(lose.proteinG).toBeGreaterThan(gain.proteinG);
    expect(gain.proteinG).toBeGreaterThan(maintain.proteinG);
  });

  it('makes carbohydrate the macro that actually swings', () => {
    expect(lose.carbsG).toBeLessThan(maintain.carbsG);
    expect(gain.carbsG).toBeGreaterThan(maintain.carbsG);
    // And by more than protein does — carbs absorb the calorie change.
    expect(gain.carbsG - lose.carbsG).toBeGreaterThan(
      Math.abs(gain.proteinG - lose.proteinG),
    );
  });

  it('keeps fat proportional rather than letting it drive the change', () => {
    expect(lose.fatG).toBeLessThan(maintain.fatG);
    // A lean gain spends its extra calories on carbohydrate, not on fat.
    expect(gain.fatG).toBeLessThanOrEqual(maintain.fatG + 5);
  });

  it('does not hand the hungriest person the lowest fibre target', () => {
    // The old bug: fibre scaled with calories alone, so a cut got 31 g while
    // a bulk got 43 g — exactly backwards for satiety, and past the point of
    // GI tolerance at the top end.
    expect(lose.fiberG).toBeGreaterThan(25);
    expect(gain.fiberG).toBeLessThanOrEqual(45);
    expect(Math.abs(lose.fiberG - gain.fiberG)).toBeLessThan(10);
  });

  it('adjusts water for the goal too', () => {
    expect(lose.waterMl).toBeGreaterThan(maintain.waterMl);
    expect(gain.waterMl).toBeGreaterThan(maintain.waterMl);
  });

  it('leaves every goal internally consistent', () => {
    for (const t of [lose, maintain, gain]) {
      expect(Math.abs(kcalFromMacros(t) - t.kcal)).toBeLessThanOrEqual(10);
      expect(t.carbsG).toBeGreaterThan(0);
      expect(t.fatG).toBeGreaterThan(0);
    }
  });
});

describe('safety rails', () => {
  it('caps the deficit in absolute terms, not just as a percentage', () => {
    // 20% of a very large maintenance would be an 800 kcal hole.
    expect(calorieTarget(4000, 'lose', 'male')).toBe(3250);
  });

  it('guarantees a real deficit for a small maintenance', () => {
    // 20% of 1400 is only 280 kcal; the floor lifts it to 300.
    expect(calorieTarget(2000, 'lose', 'male')).toBe(1600);
  });

  it('keeps a lean gain lean', () => {
    // 12% of 4000 would be 480 kcal — mostly fat gain.
    expect(calorieTarget(4000, 'gain', 'male')).toBe(4400);
  });

  it('never lets fat fall below the essential-intake floor', () => {
    // 25% of 1200 kcal is 33 g — too little for a 90 kg person.
    const macros = macroTargets(1200, 90, 'lose');
    expect(macros.fatG).toBeGreaterThanOrEqual(45);
    expect(macros.carbsG).toBeGreaterThan(0);
  });

  it('does not let the fat floor squeeze carbohydrate to nothing', () => {
    // 0.5 g/kg of 150 kg is 75 g = 675 of a 1200 kcal budget. The 35% ceiling
    // is what stops that.
    const macros = macroTargets(1200, 150, 'lose');
    expect(macros.fatG).toBeLessThanOrEqual(47);
    expect(macros.carbsG).toBeGreaterThan(0);
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

describe('trendWeightKg', () => {
  const day = (n: number) => `2026-03-${String(n).padStart(2, '0')}`;

  it('averages the weigh-ins inside the window', () => {
    const entries = [
      { loggedOn: day(10), weightKg: 80 },
      { loggedOn: day(11), weightKg: 81 },
      { loggedOn: day(12), weightKg: 79 },
    ];
    expect(trendWeightKg(entries, day(12))).toBe(80);
  });

  it('absorbs a single noisy weigh-in instead of chasing it', () => {
    // The scale reading everyone has had the morning after a salty dinner.
    const steady = Array.from({ length: 10 }, (_, i) => ({
      loggedOn: day(i + 1),
      weightKg: 70,
    }));
    const withSpike = [...steady, { loggedOn: day(11), weightKg: 72.5 }];

    const before = trendWeightKg(steady, day(10))!;
    const after = trendWeightKg(withSpike, day(11))!;
    // A 2.5 kg jump on the scale must not move the plan by 2.5 kg.
    expect(after - before).toBeLessThan(0.3);
  });

  it('does follow a real trend, just slowly', () => {
    const losing = Array.from({ length: 20 }, (_, i) => ({
      loggedOn: day(i + 1),
      weightKg: 90 - i * 0.2,
    }));
    const early = trendWeightKg(losing.slice(0, 5), day(5))!;
    const late = trendWeightKg(losing, day(20))!;
    expect(late).toBeLessThan(early);
  });

  it('ignores weigh-ins logged after the day being computed', () => {
    const entries = [
      { loggedOn: day(5), weightKg: 70 },
      { loggedOn: day(20), weightKg: 90 },
    ];
    // Recomputing the 5th must not be told about the 20th.
    expect(trendWeightKg(entries, day(5))).toBe(70);
  });

  it('does not care what order the entries arrive in', () => {
    const entries = [
      { loggedOn: day(12), weightKg: 79 },
      { loggedOn: day(10), weightKg: 80 },
      { loggedOn: day(11), weightKg: 81 },
    ];
    expect(trendWeightKg(entries, day(12))).toBe(80);
  });

  it('falls back to an old weigh-in rather than giving up', () => {
    // Someone who stopped weighing in two months ago still has a body.
    const entries = [{ loggedOn: '2026-01-01', weightKg: 65 }];
    expect(trendWeightKg(entries, '2026-03-01')).toBe(65);
  });

  it('returns null when there is nothing to average', () => {
    expect(trendWeightKg([], day(12))).toBeNull();
    expect(trendWeightKg([{ loggedOn: day(20), weightKg: 70 }], day(5))).toBeNull();
  });
});

describe('targets follow the body', () => {
  const base = { sex: 'male', heightCm: 175, ageYears: 35 } as const;

  it('lowers the calorie target as the person gets lighter', () => {
    const heavy = deriveTargets({ ...base, weightKg: 95 }, 'light', 'lose');
    const lighter = deriveTargets({ ...base, weightKg: 83 }, 'light', 'lose');
    expect(lighter.kcal).toBeLessThan(heavy.kcal);
    expect(lighter.proteinG).toBeLessThan(heavy.proteinG);
    expect(lighter.waterMl).toBeLessThan(heavy.waterMl);
  });

  it('raises the calorie target with height', () => {
    const shorter = deriveTargets({ ...base, weightKg: 70, heightCm: 160 }, 'light', 'maintain');
    const taller = deriveTargets({ ...base, weightKg: 70, heightCm: 185 }, 'light', 'maintain');
    expect(taller.kcal).toBeGreaterThan(shorter.kcal);
    // Height moves energy, not bodyweight-anchored protein.
    expect(taller.proteinG).toBe(shorter.proteinG);
  });

  it('changes the whole plan when only the goal changes', () => {
    const stats = { ...base, weightKg: 78 };
    const cutting = deriveTargets(stats, 'moderate', 'lose');
    const bulking = deriveTargets(stats, 'moderate', 'gain');
    expect(targetsEqual(cutting, bulking)).toBe(false);
  });

  it('reports identical inputs as identical targets', () => {
    const stats = { ...base, weightKg: 78 };
    expect(
      targetsEqual(
        deriveTargets(stats, 'moderate', 'lose'),
        deriveTargets(stats, 'moderate', 'lose'),
      ),
    ).toBe(true);
  });
});
