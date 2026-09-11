import type {
  ActivityLevel,
  Food,
  Goal,
  MealType,
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
 * How far the calorie target may sit from maintenance, in kcal/day.
 *
 * A flat percentage alone is the wrong tool at both ends of the range. -20%
 * of a 4000 kcal maintenance is an 800 kcal hole, which is a crash diet no
 * matter how big the person is; -20% of a 1500 kcal maintenance is 300 kcal,
 * which is barely a deficit. The percentage sets the intent, these bands keep
 * it inside what the evidence actually supports:
 *
 *  - deficit 300-750 kcal ≈ 0.3-0.75 kg/week, the range where lean mass is
 *    retained (Garthe et al., Int J Sport Nutr Exerc Metab 2011).
 *  - surplus 200-400 kcal — a lean gain. Beyond ~500 the extra calories go to
 *    fat rather than muscle, because protein synthesis is capped by training
 *    and protein intake, not by energy (Slater et al., Front Nutr 2019).
 */
const KCAL_DELTA_BAND: Record<Exclude<Goal, 'maintain'>, { min: number; max: number }> = {
  lose: { min: 300, max: 750 },
  gain: { min: 200, max: 400 },
};

/**
 * Calorie target for a goal.
 *
 * -20% for fat loss, +12% for lean gain, then clamped twice: the *change* is
 * held inside KCAL_DELTA_BAND, and the *result* is held above a sex-specific
 * floor. Rounded to the nearest 10 so the UI shows a human number.
 */
export function calorieTarget(
  maintenanceKcal: number,
  goal: Goal,
  sex: Sex,
): number {
  const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

  let adjusted = maintenanceKcal;
  if (goal === 'lose') {
    const { min, max } = KCAL_DELTA_BAND.lose;
    adjusted = maintenanceKcal - clamp(maintenanceKcal * 0.2, min, max);
  } else if (goal === 'gain') {
    const { min, max } = KCAL_DELTA_BAND.gain;
    adjusted = maintenanceKcal + clamp(maintenanceKcal * 0.12, min, max);
  }

  const floored = Math.max(adjusted, MIN_KCAL[sex]);
  return Math.round(floored / 10) * 10;
}

/**
 * Protein target in grams per kg of bodyweight, by goal.
 *
 * Highest in a deficit: protein is what stops the body from paying for the
 * missing calories out of muscle (Helms et al., Int J Sport Nutr Exerc Metab
 * 2014 — 2.3-3.1 g/kg lean mass for lean dieters; 2.0 g/kg total mass is the
 * practical equivalent for a general population). 1.6 g/kg is where the
 * hypertrophy curve flattens (Morton et al., Br J Sports Med 2018), so
 * maintenance sits there and a surplus adds a margin above it.
 */
export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose: 2.0, // higher protein preserves lean mass in a deficit
  maintain: 1.6,
  gain: 1.8,
};

/**
 * Share of total calories from fat, by goal.
 *
 * Lower on either side of maintenance, for opposite reasons: in a deficit the
 * budget is small and protein has first claim on it; in a surplus the leftover
 * calories are better spent on carbohydrate, which fuels the training that
 * makes the surplus build muscle instead of fat.
 */
export const FAT_KCAL_SHARE: Record<Goal, number> = {
  lose: 0.25,
  maintain: 0.28,
  gain: 0.25,
};

/**
 * Fat has a floor as well as a share.
 *
 * A percentage of a small calorie budget can land below the amount needed for
 * hormone production and fat-soluble vitamin absorption — a 90 kg woman on a
 * 1200 kcal floor would be handed 33 g. ~0.5 g/kg is the usual clinical
 * minimum. It is capped at 35% of calories so the floor can never squeeze
 * carbohydrate to nothing on the extreme end.
 */
const MIN_FAT_G_PER_KG = 0.5;
const MAX_FAT_KCAL_SHARE = 0.35;

/**
 * Fibre in grams per 1000 kcal, by goal.
 *
 * 14 g/1000 kcal is the US Dietary Guidelines figure, and it is the right
 * anchor for maintenance. Scaling it by calories alone, though, gives exactly
 * the wrong answer at both ends: the person in a deficit — the one who is
 * hungry, and for whom fibre's satiety and blood-sugar effects matter most —
 * gets the *smallest* fibre target, while the person eating 3000+ kcal to gain
 * is told to eat 43 g, which is past the point where volume and GI tolerance
 * become the binding constraint. So the deficit gets a richer density and the
 * surplus a leaner one, and both are clamped to a range a person can actually
 * hit.
 */
export const FIBER_G_PER_1000_KCAL: Record<Goal, number> = {
  lose: 16,
  maintain: 14,
  gain: 12,
};
const FIBER_G_RANGE = { min: 25, max: 45 } as const;

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

/**
 * Split a calorie budget into macros.
 *
 * The order is deliberate, and it is the order of how negotiable each one is:
 *
 *   1. Protein, anchored to bodyweight rather than to a percentage, because
 *      that is how the evidence is expressed. Capped at 40% of calories so a
 *      very heavy person on a deep cut is not handed a target that leaves no
 *      room for anything else.
 *   2. Fat, a share of calories, but never below ~0.5 g/kg (hormones, vitamin
 *      absorption) and never above 35% (so it cannot crowd out carbohydrate).
 *   3. Carbs take whatever remains — the flexible one, and the one whose swing
 *      between goals is the visible difference in what a day of food looks
 *      like.
 *   4. Fibre, scaled by calories at a density that itself depends on the goal.
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

  const fatFromShare = (kcal * FAT_KCAL_SHARE[goal]) / KCAL_PER_G.fat;
  const fatFloor = MIN_FAT_G_PER_KG * weightKg;
  const fatCeiling = (kcal * MAX_FAT_KCAL_SHARE) / KCAL_PER_G.fat;
  // Ceiling last: on a very small budget for a very heavy person the floor
  // would otherwise win and leave nothing for carbohydrate.
  const fatG = Math.round(Math.min(Math.max(fatFromShare, fatFloor), fatCeiling));

  const remainingKcal =
    kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;
  const carbsG = Math.max(0, Math.round(remainingKcal / KCAL_PER_G.carbs));

  const fiberRaw = (kcal / 1000) * FIBER_G_PER_1000_KCAL[goal];
  const fiberG = Math.round(
    Math.min(Math.max(fiberRaw, FIBER_G_RANGE.min), FIBER_G_RANGE.max),
  );

  return { proteinG, carbsG, fatG, fiberG };
}

/**
 * Extra water per goal, in ml.
 *
 * Water is the one target that used to ignore the goal entirely, and that was
 * wrong in both directions. A deficit means a higher protein intake, and
 * protein raises the renal solute load that has to be excreted; it also means
 * hunger, and fluid volume is one of the cheapest things that blunts it. A
 * surplus means more total food to digest and more glycogen being stored —
 * and glycogen binds roughly 3 g of water per gram. Maintenance needs neither
 * adjustment.
 *
 * These are modest numbers on purpose. The clamp below still has the last
 * word, so nobody is ever told to drink more than 4 L.
 */
const GOAL_WATER_BONUS_ML: Record<Goal, number> = {
  lose: 300,
  maintain: 0,
  gain: 250,
};

/**
 * Daily water target.
 * ~35 ml per kg of bodyweight (a widely used clinical rule of thumb), plus a
 * bump for higher activity and one for the goal, clamped to 1.5-4 L.
 *
 * `goal` is optional and defaults to 'maintain' so the older two-argument
 * callers keep the number they had.
 */
export function waterTarget(
  weightKg: number,
  activityLevel: ActivityLevel,
  goal: Goal = 'maintain',
): number {
  const activityBonusMl: Record<ActivityLevel, number> = {
    sedentary: 0,
    light: 250,
    moderate: 500,
    active: 750,
    very_active: 1000,
  };
  const raw =
    weightKg * 35 + activityBonusMl[activityLevel] + GOAL_WATER_BONUS_ML[goal];
  const clamped = Math.min(Math.max(raw, 1500), 4000);
  return Math.round(clamped / 50) * 50;
}

/**
 * The weight to build targets from: a trend, not this morning's number.
 *
 * Bodyweight swings 1-2 kg day to day on food volume, salt, glycogen and the
 * menstrual cycle — none of which is a change in the body that the targets are
 * supposed to track. Feeding a single weigh-in straight into `deriveTargets`
 * makes the whole plan twitch: protein moves ±4 g and the calorie target ±40
 * because someone ate noodles last night. Worse, it teaches people that the
 * scale controls their food, which is exactly the relationship a health app
 * should not be building.
 *
 * So the targets follow the average of the recent weigh-ins instead. It lags
 * a real trend by roughly half the window, and that is the point: a target
 * that reacts slowly to a genuine change is right, while a target that reacts
 * instantly to noise is wrong every day.
 *
 * Entries may arrive in any order and may include days after `asOf` (someone
 * correcting an old weigh-in); both are handled here rather than by callers.
 * Returns null when there is nothing in range and nothing before it either.
 */
export function trendWeightKg(
  entries: readonly { loggedOn: string; weightKg: number }[],
  asOf: string,
  windowDays = 14,
): number | null {
  const upTo = entries.filter((e) => e.loggedOn <= asOf);
  if (upTo.length === 0) return null;

  // Sorting here, not assuming it: the query that feeds this is free to change.
  const sorted = [...upTo].sort((a, b) => (a.loggedOn < b.loggedOn ? 1 : -1));
  const newest = sorted[0]!;

  const cutoff = shiftKey(newest.loggedOn, -(windowDays - 1));
  const inWindow = sorted.filter((e) => e.loggedOn >= cutoff);

  // `newest` is always in its own window, so this can never divide by zero.
  const sum = inWindow.reduce((acc, e) => acc + e.weightKg, 0);
  return Math.round((sum / inWindow.length) * 10) / 10;
}

/** Local YYYY-MM-DD shift, kept here so nutrition.ts stays dependency-free. */
function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const at = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * Are two target sets the same set of numbers?
 *
 * Used to decide whether a recomputation is worth writing. Without it, every
 * weigh-in would insert a new target version even when nothing moved, and the
 * history table would fill with rows that say nothing.
 */
export function targetsEqual(a: Targets, b: Targets): boolean {
  return (
    a.kcal === b.kcal &&
    a.proteinG === b.proteinG &&
    a.carbsG === b.carbsG &&
    a.fatG === b.fatG &&
    a.fiberG === b.fiberG &&
    a.waterMl === b.waterMl &&
    a.sleepMin === b.sleepMin &&
    a.steps === b.steps
  );
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
    waterMl: waterTarget(stats.weightKg, activityLevel, goal),
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

/**
 * Which meal a log at this hour most likely belongs to.
 *
 * Used to preselect the meal so the common case — open the app at lunchtime,
 * add lunch — takes no taps at all. The boundaries are late rather than
 * generous: someone eating at 14:00 in Indonesia is finishing lunch, not
 * starting dinner, and a wrong guess costs a correction the user may not
 * notice, so the guess should be the boring one.
 */
export function mealForHour(hour: number): MealType {
  if (hour < 4) return 'snack'; // after midnight is nobody's breakfast
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}
