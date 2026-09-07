import type { FoodEntry, FoodEntryInput, MealType, Nutrients } from '@calorya/core';
import { MEAL_TYPES, sumNutrients } from '@calorya/core';
import { requireUserId, unwrap, type CaloryaClient } from '../client';
import { toFoodEntry } from '../mappers';

export async function getFoodEntries(
  client: CaloryaClient,
  dateKey: string,
): Promise<FoodEntry[]> {
  const userId = await requireUserId(client);
  const rows = unwrap(
    await client
      .from('food_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('logged_on', dateKey)
      .order('logged_at', { ascending: true }),
    'getFoodEntries',
  );
  return rows.map(toFoodEntry);
}

export interface MealGroup {
  meal: MealType;
  entries: FoodEntry[];
  totals: Nutrients;
}

/** Entries grouped into the four meals, in a stable order, totals included. */
export function groupByMeal(entries: readonly FoodEntry[]): MealGroup[] {
  return MEAL_TYPES.map((meal) => {
    const forMeal = entries.filter((entry) => entry.meal === meal);
    return { meal, entries: forMeal, totals: sumNutrients(forMeal) };
  });
}

export async function addFoodEntry(
  client: CaloryaClient,
  input: FoodEntryInput,
): Promise<FoodEntry> {
  const userId = await requireUserId(client);
  // The nutrition snapshot is filled in by the database trigger.
  const row = unwrap(
    await client
      .from('food_entries')
      .insert({
        user_id: userId,
        food_id: input.foodId,
        logged_on: input.loggedOn,
        meal: input.meal,
        quantity_g: input.quantityG,
      })
      .select()
      .single(),
    'addFoodEntry',
  );
  return toFoodEntry(row);
}

export async function updateFoodEntryQuantity(
  client: CaloryaClient,
  entryId: string,
  quantityG: number,
): Promise<FoodEntry> {
  const userId = await requireUserId(client);
  const row = unwrap(
    await client
      .from('food_entries')
      .update({ quantity_g: quantityG })
      .eq('id', entryId)
      .eq('user_id', userId)
      .select()
      .single(),
    'updateFoodEntryQuantity',
  );
  return toFoodEntry(row);
}

export async function deleteFoodEntry(
  client: CaloryaClient,
  entryId: string,
): Promise<void> {
  const userId = await requireUserId(client);
  const { error } = await client
    .from('food_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);
  if (error) throw new Error(`deleteFoodEntry: ${error.message}`);
}

/**
 * Copy a whole meal from another day.
 * Re-inserting by food_id (not by snapshot) is deliberate: the copy should
 * reflect the food as it is defined now.
 */
export async function copyMeal(
  client: CaloryaClient,
  fromDate: string,
  toDate: string,
  meal: MealType,
): Promise<FoodEntry[]> {
  const userId = await requireUserId(client);
  const source = unwrap(
    await client
      .from('food_entries')
      .select('food_id, quantity_g')
      .eq('user_id', userId)
      .eq('logged_on', fromDate)
      .eq('meal', meal),
    'copyMeal/read',
  );

  if (source.length === 0) return [];

  const rows = unwrap(
    await client
      .from('food_entries')
      .insert(
        source.map((entry) => ({
          user_id: userId,
          food_id: entry.food_id,
          logged_on: toDate,
          meal,
          quantity_g: entry.quantity_g,
        })),
      )
      .select(),
    'copyMeal/write',
  );
  return rows.map(toFoodEntry);
}
