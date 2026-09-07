import type { FoodInput } from './schemas';

/**
 * Barcode handling: validation, normalisation, and mapping an Open Food Facts
 * product onto our own food shape.
 *
 * All pure. The camera lives in the apps and the network call lives in
 * @calorya/api; everything that can be reasoned about — and got wrong — is
 * here, where it is cheap to test.
 */

export type BarcodeFormat = 'ean13' | 'ean8' | 'upca' | 'upce' | 'unknown';

/** Strip spaces, dashes and anything else a scanner or a human might add. */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * GS1 modulo-10 check digit.
 *
 * One algorithm covers EAN-8, UPC-A, EAN-13 and GTIN-14: walking the payload
 * from the right, weights alternate 3, 1, 3, 1… Writing it per-format (as most
 * tutorials do) is where the off-by-one bugs live.
 */
export function checkDigit(payload: string): number {
  let sum = 0;
  for (let i = payload.length - 1, weight = 3; i >= 0; i -= 1, weight = weight === 3 ? 1 : 3) {
    sum += Number(payload[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

export function barcodeFormat(code: string): BarcodeFormat {
  switch (code.length) {
    case 13:
      return 'ean13';
    case 12:
      return 'upca';
    case 8:
      return 'ean8';
    default:
      return 'unknown';
  }
}

/**
 * Is this a real product barcode?
 *
 * The check digit matters: a misread digit is far more common than a missing
 * one, and validating locally means we never burn a network round-trip — or
 * show a "product not found" that was really a bad scan.
 */
export function isValidBarcode(raw: string): boolean {
  const code = normalizeBarcode(raw);
  if (![8, 12, 13].includes(code.length)) return false;
  const body = code.slice(0, -1);
  const given = Number(code[code.length - 1]);
  return checkDigit(body) === given;
}

/**
 * Normalise to EAN-13, which is what most catalogues key on.
 * A UPC-A is an EAN-13 with a leading zero; EAN-8 stays as it is.
 */
export function toEan13(raw: string): string | null {
  const code = normalizeBarcode(raw);
  if (!isValidBarcode(code)) return null;
  if (code.length === 12) return `0${code}`;
  return code;
}

// --- Open Food Facts ---------------------------------------------------------

/** The subset of the Open Food Facts product we actually read. */
export interface OpenFoodFactsProduct {
  code?: string;
  product_name?: string;
  product_name_id?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (value: number | string | undefined): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const clamp = (value: number, max: number): number =>
  Math.max(0, Math.min(max, Math.round(value * 100) / 100));

/**
 * Energy per 100 g.
 *
 * Open Food Facts sometimes carries only kilojoules, so fall back and convert
 * rather than importing a food with 0 kcal — which would silently make a whole
 * day of logging wrong.
 */
export function kcalPer100g(nutriments: Record<string, number | string | undefined>): number | null {
  const kcal = num(nutriments['energy-kcal_100g']);
  if (kcal !== null) return kcal;

  const kj = num(nutriments['energy-kj_100g']) ?? num(nutriments['energy_100g']);
  if (kj !== null) return kj / 4.184;

  return null;
}

/**
 * Sodium in mg per 100 g.
 * OFF reports sodium and salt in GRAMS. Our column is milligrams, and missing
 * that factor of 1000 is the classic import bug. Salt converts at 1 g salt =
 * 0.4 g sodium.
 */
export function sodiumMgPer100g(
  nutriments: Record<string, number | string | undefined>,
): number | null {
  const sodiumG = num(nutriments['sodium_100g']);
  if (sodiumG !== null) return sodiumG * 1000;

  const saltG = num(nutriments['salt_100g']);
  if (saltG !== null) return saltG * 400;

  return null;
}

export interface MappedProduct {
  food: FoodInput;
  /** Fields Open Food Facts had nothing for, so the user can fill them in. */
  missing: string[];
}

/**
 * Map an Open Food Facts product to a food we can store.
 *
 * Returns null only when the product has no usable name or no energy value —
 * anything else is imported with the gaps reported, because a product with
 * known calories and unknown fibre is still worth logging.
 */
export function mapOpenFoodFactsProduct(
  product: OpenFoodFactsProduct,
  barcode: string,
): MappedProduct | null {
  const name = (product.product_name || product.generic_name || '').trim();
  if (!name) return null;

  const nutriments = product.nutriments ?? {};
  const kcal = kcalPer100g(nutriments);
  if (kcal === null) return null;

  const missing: string[] = [];
  const pick = (key: string, label: string, max: number): number => {
    const value = num(nutriments[key]);
    if (value === null) {
      missing.push(label);
      return 0;
    }
    return clamp(value, max);
  };

  const sodium = sodiumMgPer100g(nutriments);
  if (sodium === null) missing.push('natrium');

  const servingG = num(product.serving_quantity);
  const brand = (product.brands ?? '').split(',')[0]?.trim() || null;

  return {
    food: {
      name: name.slice(0, 120),
      brand: brand ? brand.slice(0, 80) : null,
      barcode: barcode.slice(0, 32),
      kcal: clamp(kcal, 900),
      proteinG: pick('proteins_100g', 'protein', 100),
      carbsG: pick('carbohydrates_100g', 'karbohidrat', 100),
      fatG: pick('fat_100g', 'lemak', 100),
      fiberG: pick('fiber_100g', 'serat', 100),
      sugarG: pick('sugars_100g', 'gula', 100),
      sodiumMg: sodium === null ? 0 : clamp(sodium, 50000),
      servingLabel: product.serving_size?.trim().slice(0, 40) || null,
      servingG: servingG !== null && servingG > 0 ? clamp(servingG, 5000) : null,
      isLiquid: false,
    },
    missing,
  };
}
