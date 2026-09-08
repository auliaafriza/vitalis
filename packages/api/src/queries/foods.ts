import { toEan13, type Food, type FoodCategory, type FoodInput } from '@calorya/core';
import { lookupBarcode, type OpenFoodFactsOptions } from '../openfoodfacts';
import { requireUserId, unwrap, unwrapMaybe, type CaloryaClient } from '../client';
import { toFood } from '../mappers';

/**
 * Ranked search over the public catalogue plus the user's own foods,
 * optionally narrowed to one category.
 *
 * Browsing a category tile and typing in the search box are the same call with
 * different arguments — one query to reason about, one ranking, and no way for
 * the two paths to disagree about what exists.
 */
export async function searchFoods(
  client: CaloryaClient,
  query: string,
  limit = 25,
  category?: FoodCategory,
): Promise<Food[]> {
  const rows = unwrap(
    await client.rpc('search_foods', {
      query,
      max_results: limit,
      in_category: category ?? undefined,
    }),
    'searchFoods',
  );
  return rows.map(toFood);
}

/** The catalogue shown before the user types anything. */
export async function listFoods(
  client: CaloryaClient,
  limit = 30,
  category?: FoodCategory,
): Promise<Food[]> {
  return searchFoods(client, '', limit, category);
}

export async function getFood(client: CaloryaClient, id: string): Promise<Food | null> {
  const row = unwrapMaybe(
    await client.from('foods').select('*').eq('id', id).maybeSingle(),
    'getFood',
  );
  return row ? toFood(row) : null;
}

export async function findByBarcode(
  client: CaloryaClient,
  barcode: string,
): Promise<Food | null> {
  // A UPC-A scanned off a bottle and the EAN-13 stored in the catalogue are the
  // same product, so match on both spellings rather than only what was scanned.
  const candidates = [barcode, toEan13(barcode)].filter(
    (value): value is string => Boolean(value),
  );
  const rows = unwrap(
    await client.from('foods').select('*').in('barcode', [...new Set(candidates)]).limit(1),
    'findByBarcode',
  );
  const row = rows[0];
  return row ? toFood(row) : null;
}

export type BarcodeResolution =
  | { status: 'catalogue'; food: Food }
  | { status: 'imported'; food: Food; missing: string[] }
  | { status: 'not_found' }
  | { status: 'unusable' }
  | { status: 'invalid_barcode' }
  | { status: 'offline' };

/**
 * Resolve a scanned barcode to a food the user can log.
 *
 * Order matters: our own catalogue first, so a product someone already
 * corrected by hand is never overwritten by the upstream copy. Only on a miss
 * do we ask Open Food Facts, and an imported product is saved as a private food
 * owned by the importer — a stranger's scan should not be able to edit the
 * shared catalogue.
 */
export async function resolveBarcode(
  client: CaloryaClient,
  barcode: string,
  options?: OpenFoodFactsOptions,
): Promise<BarcodeResolution> {
  const known = await findByBarcode(client, barcode);
  if (known) return { status: 'catalogue', food: known };

  const result = await lookupBarcode(barcode, options);
  switch (result.status) {
    case 'found': {
      const food = await createFood(client, result.food);
      return { status: 'imported', food, missing: result.missing };
    }
    case 'not_found':
      return { status: 'not_found' };
    case 'unusable':
      return { status: 'unusable' };
    case 'invalid_barcode':
      return { status: 'invalid_barcode' };
    default:
      return { status: 'offline' };
  }
}

/** Foods the user has logged most often — the top of the "add food" screen. */
export async function recentFoods(client: CaloryaClient, limit = 12): Promise<Food[]> {
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
export async function createFood(client: CaloryaClient, input: FoodInput): Promise<Food> {
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
        // Anything arriving by barcode came off a package, by definition.
        category: input.category ?? (input.barcode ? 'packaged' : 'other'),
        is_public: false,
        created_by: userId,
      })
      .select()
      .single(),
    'createFood',
  );
  return toFood(row);
}
