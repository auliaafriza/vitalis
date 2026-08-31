import type {
  ActivityLevel,
  Food,
  Goal,
  Nutrients,
  Sex,
  Targets,
} from './types';

/**
 * Energy and macronutrient math.
 *
 * Every formula here is a published one, cited at its definition, because a
 * health app that invents its own numbers is worse than useless. Nothing in
 * this file touches the network, the DOM, or React — which is exactly why the
 * web app and the Expo app can share it, and why it is cheap to unit-test.
 */

// --- Atwater factors (kcal per gram) ---------------------------------------
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * Physical Activity Level multipliers applied to BMR.
 * Source: FAO/WHO/UNU Human Energy Requirements (2004), common clinical bands.
 */
export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Absolute floors so an aggressive deficit can never produce unsafe advice. */
const MIN_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };

export interface BodyStats {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}

/**
 * Basal Metabolic Rate — Mifflin-St Jeor equation.
 * Mifflin MD et al., Am J Clin Nutr 1990;51(2):241-7. Chosen over
 * Harris-Benedict because it is more accurate for modern populations.
 */
export function bmr({ sex, weightKg, heightCm, ageYears }: BodyStats): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

/** Total Daily Energy Expenditure = BMR x activity multiplier. */
export function tdee(stats: BodyStats, activityLevel: ActivityLevel): number {
  return Math.round(bmr(stats) * ACTIVITY_MULTIPLIER[activityLevel]);
}

/**
 * Calorie target for a goal.
 * -20% for fat loss (~0.5-0.7 kg/week), +12% for lean gain, clamped to a
 * safe floor. Rounded to the nearest 10 so the UI shows a human number.
 */
export function calorieTarget(
  maintenanceKcal: number,
  goal: Goal,
  sex: Sex,
): number {
  const adjusted =
    goal === 'lose'
      ? maintenanceKcal * 0.8
      : goal === 'gain'
        ? maintenanceKcal * 1.12
        : maintenanceKcal;

  const floored = Math.max(adjusted, MIN_KCAL[sex]);
  return Math.round(floored / 10) * 10;
}

/** Protein target in grams per kg of bodyweight, by goal. */
const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose: 2.0, // higher protein preserves lean mass in a deficit
  maintain: 1.6,
  gain: 1.8,
};

/** Share of total calories from fat, by goal. */
const FAT_KCAL_SHARE: Record<Goal, number> = {
  lose: 0.25,
  maintain: 0.28,
  gain: 0.25,
};

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

/**
 * Split a calorie budget into macros.
 *
 * Protein is anchored to bodyweight (not to a percentage) because that is how
 * the evidence is actually expressed. It is then capped at 40% of calories so
 * a very heavy person on a deep cut does not get a target that leaves no room
 * for anything else. Carbs take whatever remains.
 *
 * Fiber: 14 g per 1000 kcal (US Dietary Guidelines).
 */
export function macroTargets(
  kcal: number,
  weightKg: number,
  goal: Goal,
): MacroTargets {
  const proteinCap = (kcal * 0.4) / KCAL_PER_G.protein;
  const proteinG = Math.round(
    Math.min(PROTEIN_G_PER_KG[goal] * weightKg, proteinCap),
  );

  const fatG = Math.round((kcal * FAT_KCAL_SHARE[goal]) / KCAL_PER_G.fat);

  const remainingKcal =
    kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;
  const carbsG = Math.max(0, Math.round(remainingKcal / KCAL_PER_G.carbs));

  const fiberG = Math.round((kcal / 1000) * 14);

  return { proteinG, carbsG, fatG, fiberG };
}

/**
 * Daily water target.
 * ~35 ml per kg of bodyweight (a widely used clinical rule of thumb), plus a
 * bump for higher activity, clamped to 1.5-4 L.
 */
export function waterTarget(weightKg: number, activityLevel: ActivityLevel): number {
  const activityBonusMl: Record<ActivityLevel, number> = {
    sedentary: 0,
    light: 250,
    moderate: 500,
    active: 750,
    very_active: 1000,
  };
  const raw = weightKg * 35 + activityBonusMl[activityLevel];
  const clamped = Math.min(Math.max(raw, 1500), 4000);
  return Math.round(clamped / 50) * 50;
}

/** Everything the dashboard rings need, derived from a profile. */
export function deriveTargets(
  stats: BodyStats,
  activityLevel: ActivityLevel,
  goal: Goal,
): Targets {
  const maintenance = tdee(stats, activityLevel);
  const kcal = calorieTarget(maintenance, goal, stats.sex);
  const macros = macroTargets(kcal, stats.weightKg, goal);

  return {
    kcal,
    proteinG: macros.proteinG,
    carbsG: macros.carbsG,
    fatG: macros.fatG,
    fiberG: macros.fiberG,
    waterMl: waterTarget(stats.weightKg, activityLevel),
    sleepMin: 480,
    steps: activityLevel === 'sedentary' ? 6000 : 8000,
  };
}

// --- Portion math -----------------------------------------------------------

export const ZERO_NUTRIENTS: Readonly<Nutrients> = Object.freeze({
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 0,
});

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Scale a food's per-100 g values to an actual portion. */
export function nutrientsForQuantity(food: Nutrients, grams: number): Nutrients {
  if (grams < 0) throw new RangeError('quantity must not be negative');
  const factor = grams / 100;
  return {
    kcal: round2(food.kcal * factor),
    proteinG: round2(food.proteinG * factor),
    carbsG: round2(food.carbsG * factor),
    fatG: round2(food.fatG * factor),
    fiberG: round2(food.fiberG * factor),
    sugarG: round2(food.sugarG * factor),
    sodiumMg: round2(food.sodiumMg * factor),
  };
}

/** Add up any list of nutrient-bearing rows. */
export function sumNutrients(items: readonly Nutrients[]): Nutrients {
  return items.reduce<Nutrients>(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      proteinG: acc.proteinG + n.proteinG,
      carbsG: acc.carbsG + n.carbsG,
      fatG: acc.fatG + n.fatG,
      fiberG: acc.fiberG + n.fiberG,
      sugarG: acc.sugarG + n.sugarG,
      sodiumMg: acc.sodiumMg + n.sodiumMg,
    }),
    { ...ZERO_NUTRIENTS },
  );
}

/** Calories implied by the macros, using Atwater factors. */
export function kcalFromMacros(n: Pick<Nutrients, 'proteinG' | 'carbsG' | 'fatG'>): number {
  return Math.round(
    n.proteinG * KCAL_PER_G.protein +
      n.carbsG * KCAL_PER_G.carbs +
      n.fatG * KCAL_PER_G.fat,
  );
}

/** Percentage of calories from each macro — for the donut on the nutrition tab. */
export function macroSplit(n: Pick<Nutrients, 'proteinG' | 'carbsG' | 'fatG'>): {
  protein: number;
  carbs: number;
  fat: number;
} {
  const total = kcalFromMacros(n);
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round(((n.proteinG * KCAL_PER_G.protein) / total) * 100),
    carbs: Math.round(((n.carbsG * KCAL_PER_G.carbs) / total) * 100),
    fat: Math.round(((n.fatG * KCAL_PER_G.fat) / total) * 100),
  };
}

/**
 * Default portion for a food: its stated serving if it has one, else 100 g.
 * Small quality-of-life detail that removes a keyboard from the common path.
 */
export function defaultPortionG(food: Pick<Food, 'servingG'>): number {
  return food.servingG && food.servingG > 0 ? food.servingG : 100;
}
