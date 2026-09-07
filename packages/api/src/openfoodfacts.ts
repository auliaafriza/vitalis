import {
  mapOpenFoodFactsProduct,
  toEan13,
  type MappedProduct,
  type OpenFoodFactsProduct,
} from '@calorya/core';

/**
 * Open Food Facts lookup.
 *
 * A free, open, community-maintained product database with reasonable coverage
 * of Indonesian packaged goods. It is the only network call in this package
 * that does not go to Supabase, which is why it lives in its own file.
 *
 * Their terms ask every client to identify itself; an anonymous scraper-looking
 * client can be rate-limited or blocked, so the User-Agent is not optional.
 */

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';

/** Only the fields we map, so the response stays small on a phone connection. */
const FIELDS = [
  'code',
  'product_name',
  'generic_name',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'nutriments',
].join(',');

export interface OpenFoodFactsOptions {
  /** Identifies this app to Open Food Facts. Override per deployment. */
  userAgent?: string;
  /** Give up rather than leave the user staring at a spinner. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type BarcodeLookupResult =
  | { status: 'found'; source: 'openfoodfacts'; barcode: string } & MappedProduct
  | { status: 'not_found'; barcode: string }
  /** The product exists but has no name or no energy — not usable as a food. */
  | { status: 'unusable'; barcode: string }
  | { status: 'invalid_barcode'; barcode: string }
  | { status: 'offline'; barcode: string };

/**
 * Look a barcode up in Open Food Facts.
 *
 * Never throws: a scanner that explodes on a flaky connection is worse than one
 * that says "tidak ada koneksi". Every failure mode is a value the UI can act on.
 */
export async function lookupBarcode(
  rawBarcode: string,
  options: OpenFoodFactsOptions = {},
): Promise<BarcodeLookupResult> {
  const {
    userAgent = 'Calorya/0.1 (https://github.com/calorya)',
    timeoutMs = 8000,
    fetchImpl = fetch,
  } = options;

  const barcode = toEan13(rawBarcode);
  if (!barcode) return { status: 'invalid_barcode', barcode: rawBarcode };

  try {
    const response = await fetchImpl(
      `${ENDPOINT}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
      {
        headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    // 404 is Open Food Facts' normal "we don't have it", not an error.
    if (response.status === 404) return { status: 'not_found', barcode };
    if (!response.ok) return { status: 'offline', barcode };

    const body = (await response.json()) as {
      status?: number;
      product?: OpenFoodFactsProduct;
    };

    if (body.status !== 1 || !body.product) return { status: 'not_found', barcode };

    const mapped = mapOpenFoodFactsProduct(body.product, barcode);
    if (!mapped) return { status: 'unusable', barcode };

    return { status: 'found', source: 'openfoodfacts', barcode, ...mapped };
  } catch {
    // Timeout, DNS failure, aeroplane mode — all the same to the caller.
    return { status: 'offline', barcode };
  }
}
