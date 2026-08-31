import type { Food, FoodInput } from '@vitalis/core';
import { requireUserId, unwrap, unwrapMaybe, type VitalisClient } from '../client';
import { toFood } from '../mappers';

/** Ranked search over the public catalogue plus the user's own foods. */
export async function searchFoods(
  client: VitalisClient,
  query: string,
  limit = 25,
): Promise<Food[]> {
  const rows = unwrap(
    await client.rpc('search_foods', { query, max_results: limit }),
    'searchFoods',
  );
  return rows.map(toFood);
}

/** The catalogue shown before the user types anything. */
export async function listFoods(client: VitalisClient, limit = 30): Promise<Food[]> {
  const rows = unwrap(
    await client.from('foods').select('*').order('name').limit(limit),
    'listFoods',
  );
  return rows.map(toFood);
}

export async function getFood(client: VitalisClient, id: string): Promise<Food | null> {
  const row = unwrapMaybe(
    await client.from('foods').select('*').eq('id', id).maybeSingle(),
    'getFood',
  );
  return row ? toFood(row) : null;
}

export async function findByBarcode(
  client: VitalisClient,
  barcode: string,
): Promise<Food | null> {
  const row = unwrapMaybe(
    await client.from('foods').select('*').eq('barcode', barcode).limit(1).maybeSingle(),
    'findByBarcode',
  );
  return row ? toFood(row) : null;
}

/** Foods the user has logged most often — the top of the "add food" screen. */
export async function recentFoods(client: VitalisClient, limit = 12): Promise<Food[]> {
  const userId = await requireUserId(client);
  const entries = unwrap(
    await client
      .from('food_entries')
      .select('food_id, logged_at')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(120),
    'recentFoods/entries',
  );

  const seen: string[] = [];
  for (const entry of entries) {
    if (!seen.includes(entry.food_id)) seen.push(entry.food_id);
    if (seen.length >= limit) break;
  }
  if (seen.length === 0) return [];

  const rows = unwrap(
    await client.from('foods').select('*').in('id', seen),
    'recentFoods/foods',
  );

  // Preserve recency order, which the `in` filter does not guarantee.
  const byId = new Map(rows.map((row) => [row.id, toFood(row)]));
  return seen.flatMap((id) => {
    const food = byId.get(id);
    return food ? [food] : [];
  });
}

/** Create a private food owned by the current user. */
export async function createFood(client: VitalisClient, input: FoodInput): Promise<Food> {
  const userId = await requireUserId(client);
  const row = unwrap(
    await client
      .from('foods')
      .insert({
        name: input.name,
        brand: input.brand ?? null,
        barcode: input.barcode ?? null,
        kcal: input.kcal,
        protein_g: input.proteinG,
        carbs_g: input.carbsG,
        fat_g: input.fatG,
        fiber_g: input.fiberG,
        sugar_g: input.sugarG,
        sodium_mg: input.sodiumMg,
        serving_label: input.servingLabel ?? null,
        serving_g: input.servingG ?? null,
        is_liquid: input.isLiquid,
        is_public: false,
        created_by: userId,
      })
      .select()
      .single(),
    'createFood',
  );
  return toFood(row);
}
