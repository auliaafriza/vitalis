import { describe, expect, it } from 'vitest';
import {
  barcodeFormat,
  checkDigit,
  isValidBarcode,
  kcalPer100g,
  mapOpenFoodFactsProduct,
  normalizeBarcode,
  sodiumMgPer100g,
  toEan13,
  type OpenFoodFactsProduct,
} from '../barcode';

describe('normalizeBarcode', () => {
  it('strips anything that is not a digit', () => {
    expect(normalizeBarcode(' 899-686 001 234 ')).toBe('899686001234');
    expect(normalizeBarcode('\n8998866200189\t')).toBe('8998866200189');
  });
});

describe('checkDigit', () => {
  it('matches the published EAN-13 example', () => {
    // 4006381333931 — the example used in the GS1 documentation
    expect(checkDigit('400638133393')).toBe(1);
  });

  it('matches a UPC-A example', () => {
    // 036000291452
    expect(checkDigit('03600029145')).toBe(2);
  });

  it('matches an EAN-8 example', () => {
    // 96385074
    expect(checkDigit('9638507')).toBe(4);
  });
});

describe('isValidBarcode', () => {
  it('accepts real Indonesian product codes', () => {
    expect(isValidBarcode('8998866200189')).toBe(true); // Indomie
    expect(isValidBarcode('8992388101016')).toBe(true);
  });

  it('accepts UPC-A and EAN-8', () => {
    expect(isValidBarcode('036000291452')).toBe(true);
    expect(isValidBarcode('96385074')).toBe(true);
  });

  it('rejects a single mistyped digit', () => {
    // The whole point of the check digit: a misread is caught locally.
    expect(isValidBarcode('8998866200188')).toBe(false);
    expect(isValidBarcode('4006381333932')).toBe(false);
  });

  it('rejects the wrong number of digits', () => {
    expect(isValidBarcode('12345')).toBe(false);
    expect(isValidBarcode('12345678901234')).toBe(false);
    expect(isValidBarcode('')).toBe(false);
  });

  it('tolerates spaces and dashes around a valid code', () => {
    expect(isValidBarcode('899-8866-200189')).toBe(true);
  });
});

describe('toEan13', () => {
  it('pads UPC-A with a leading zero', () => {
    expect(toEan13('036000291452')).toBe('0036000291452');
  });

  it('leaves EAN-13 and EAN-8 alone', () => {
    expect(toEan13('8998866200189')).toBe('8998866200189');
    expect(toEan13('96385074')).toBe('96385074');
  });

  it('returns null for an invalid code', () => {
    expect(toEan13('8998866200188')).toBeNull();
  });
});

describe('barcodeFormat', () => {
  it('names the common formats', () => {
    expect(barcodeFormat('8998866200189')).toBe('ean13');
    expect(barcodeFormat('036000291452')).toBe('upca');
    expect(barcodeFormat('96385074')).toBe('ean8');
    expect(barcodeFormat('123')).toBe('unknown');
  });
});

describe('kcalPer100g', () => {
  it('prefers a direct kcal value', () => {
    expect(kcalPer100g({ 'energy-kcal_100g': 452 })).toBe(452);
  });

  it('converts kilojoules when kcal is absent', () => {
    // 1000 kJ / 4.184 = 239.0 kcal
    expect(kcalPer100g({ 'energy-kj_100g': 1000 })).toBeCloseTo(239.0, 1);
    expect(kcalPer100g({ energy_100g: 2000 })).toBeCloseTo(478.0, 1);
  });

  it('accepts numeric strings, as the API sometimes sends', () => {
    expect(kcalPer100g({ 'energy-kcal_100g': '380' })).toBe(380);
  });

  it('returns null when there is no energy at all', () => {
    expect(kcalPer100g({})).toBeNull();
    expect(kcalPer100g({ 'energy-kcal_100g': '' })).toBeNull();
  });
});

describe('sodiumMgPer100g', () => {
  it('converts grams to milligrams', () => {
    // The factor-of-1000 bug this test exists to prevent.
    expect(sodiumMgPer100g({ sodium_100g: 1.2 })).toBe(1200);
  });

  it('derives sodium from salt when only salt is given', () => {
    expect(sodiumMgPer100g({ salt_100g: 1 })).toBe(400);
  });

  it('returns null when neither is present', () => {
    expect(sodiumMgPer100g({})).toBeNull();
  });
});

describe('mapOpenFoodFactsProduct', () => {
  const indomie: OpenFoodFactsProduct = {
    code: '8998866200189',
    product_name: 'Mi Goreng Instan',
    brands: 'Indomie, Indofood',
    serving_size: '85 g',
    serving_quantity: 85,
    nutriments: {
      'energy-kcal_100g': 460,
      proteins_100g: 10,
      carbohydrates_100g: 60,
      fat_100g: 20,
      fiber_100g: 2.4,
      sugars_100g: 4,
      sodium_100g: 1.7,
    },
  };

  it('maps a complete product', () => {
    const result = mapOpenFoodFactsProduct(indomie, '8998866200189');
    expect(result).not.toBeNull();
    expect(result!.food.name).toBe('Mi Goreng Instan');
    expect(result!.food.brand).toBe('Indomie'); // first brand only
    expect(result!.food.kcal).toBe(460);
    expect(result!.food.sodiumMg).toBe(1700); // grams -> mg
    expect(result!.food.servingG).toBe(85);
    expect(result!.food.servingLabel).toBe('85 g');
    expect(result!.missing).toEqual([]);
  });

  it('reports which nutrients were missing instead of silently zeroing them', () => {
    const sparse: OpenFoodFactsProduct = {
      product_name: 'Keripik Singkong',
      nutriments: { 'energy-kcal_100g': 520, proteins_100g: 3 },
    };
    const result = mapOpenFoodFactsProduct(sparse, '8991234567890');
    expect(result!.food.kcal).toBe(520);
    expect(result!.food.proteinG).toBe(3);
    expect(result!.food.carbsG).toBe(0);
    expect(result!.missing).toContain('karbohidrat');
    expect(result!.missing).toContain('lemak');
    expect(result!.missing).toContain('natrium');
    expect(result!.missing).not.toContain('protein');
  });

  it('falls back to the generic name', () => {
    const result = mapOpenFoodFactsProduct(
      { generic_name: 'Susu UHT', nutriments: { 'energy-kcal_100g': 61 } },
      '8991111111116',
    );
    expect(result!.food.name).toBe('Susu UHT');
  });

  it('rejects a product with no name', () => {
    expect(
      mapOpenFoodFactsProduct({ nutriments: { 'energy-kcal_100g': 100 } }, '8991111111116'),
    ).toBeNull();
  });

  it('rejects a product with no energy — importing 0 kcal would corrupt a day', () => {
    expect(mapOpenFoodFactsProduct({ product_name: 'Sesuatu' }, '8991111111116')).toBeNull();
  });

  it('clamps absurd values rather than failing the database check constraints', () => {
    const result = mapOpenFoodFactsProduct(
      {
        product_name: 'Data rusak',
        nutriments: { 'energy-kcal_100g': 99999, proteins_100g: 900 },
      },
      '8991111111116',
    );
    expect(result!.food.kcal).toBe(900);
    expect(result!.food.proteinG).toBe(100);
  });
});
