import { describe, expect, it, vi } from 'vitest';
import { lookupBarcode } from '../openfoodfacts';

/**
 * lookupBarcode takes its fetch as a parameter precisely so this suite can run
 * without a network: every branch the UI has to handle is exercised here.
 */

const ok = (body: unknown, status = 200) =>
  vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

const REAL_SHAPE = {
  status: 1,
  product: {
    code: '3017620422003',
    product_name: 'Nutella',
    brands: 'Ferrero, Nutella',
    serving_size: '15 g',
    serving_quantity: 15,
    nutriments: {
      'energy-kcal_100g': 539,
      proteins_100g: 6.3,
      carbohydrates_100g: 57.5,
      fat_100g: 30.9,
      fiber_100g: 0,
      sugars_100g: 56.3,
      salt_100g: 0.107,
    },
  },
};

describe('lookupBarcode', () => {
  it('maps a real-shaped response', async () => {
    const fetchImpl = ok(REAL_SHAPE);
    const result = await lookupBarcode('3017620422003', { fetchImpl });

    expect(result.status).toBe('found');
    if (result.status !== 'found') return;
    expect(result.food.name).toBe('Nutella');
    expect(result.food.brand).toBe('Ferrero');
    expect(result.food.kcal).toBe(539);
    expect(result.food.sodiumMg).toBeCloseTo(42.8, 1); // salt 0.107 g -> 42.8 mg
    expect(result.food.barcode).toBe('3017620422003');
  });

  it('requests only the fields it maps, and identifies itself', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      seenUrl = String(input);
      seenHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify(REAL_SHAPE), { status: 200 });
    };

    await lookupBarcode('3017620422003', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      userAgent: 'Calorya-Test/1.0',
    });

    expect(seenUrl).toContain('/api/v2/product/3017620422003.json');
    expect(seenUrl).toContain('fields=');
    expect(seenUrl).not.toContain('images'); // keep the payload small on mobile data
    expect(seenHeaders['User-Agent']).toBe('Calorya-Test/1.0');
  });

  it('normalises UPC-A to EAN-13 before asking', async () => {
    let seenUrl = '';
    const fetchImpl = async (input: string | URL | Request) => {
      seenUrl = String(input);
      return new Response(JSON.stringify({ status: 0 }), { status: 200 });
    };
    await lookupBarcode('036000291452', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(seenUrl).toContain('/0036000291452.json');
  });

  it('never hits the network for an invalid check digit', async () => {
    const fetchImpl = ok(REAL_SHAPE);
    const result = await lookupBarcode('8998866200188', { fetchImpl });
    expect(result.status).toBe('invalid_barcode');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats status 0 and 404 as "not found", not as errors', async () => {
    expect((await lookupBarcode('8998866200189', { fetchImpl: ok({ status: 0 }) })).status)
      .toBe('not_found');
    expect((await lookupBarcode('8998866200189', { fetchImpl: ok({}, 404) })).status)
      .toBe('not_found');
  });

  it('reports a product without energy as unusable rather than importing 0 kcal', async () => {
    const fetchImpl = ok({
      status: 1,
      product: { product_name: 'Air Mineral', nutriments: {} },
    });
    expect((await lookupBarcode('8998866200189', { fetchImpl })).status).toBe('unusable');
  });

  it('reports server errors as offline', async () => {
    expect((await lookupBarcode('8998866200189', { fetchImpl: ok({}, 503) })).status)
      .toBe('offline');
  });

  it('never throws when the network fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(lookupBarcode('8998866200189', { fetchImpl })).resolves.toMatchObject({
      status: 'offline',
    });
  });

  it('never throws on malformed JSON', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('<html>maintenance</html>', { status: 200 }),
    );
    await expect(lookupBarcode('8998866200189', { fetchImpl })).resolves.toMatchObject({
      status: 'offline',
    });
  });
});
