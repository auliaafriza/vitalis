'use client';

import {
  defaultPortionG,
  formatKcal,
  MEAL_LABEL,
  nutrientsForQuantity,
  type Food,
  type MealType,
} from '@calorya/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAddFood, useFoodSearch, useRecentFoods, useResolveBarcode } from '@/lib/hooks';
import { BarcodeScanner } from './barcode-scanner';
import { Button, Field, inputClass, Skeleton } from './ui';

/**
 * Two-step picker: choose a food, then choose the portion.
 *
 * Splitting it means the portion step can show the *actual* calories for the
 * amount being entered, updated as the user types — which is the number they
 * care about, and the reason the maths lives in a synchronous shared package.
 */
export function FoodPicker({
  day,
  meal,
  initialFood,
  onClose,
}: {
  day: string;
  meal: MealType;
  /**
   * A food already chosen on the page behind the dialog — from the category
   * grid, the recents list, or a scan. Opening straight on the portion step
   * means the browse UI is not duplicated inside the dialog it launched.
   */
  initialFood?: Food | null;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(initialFood ?? null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = useFoodSearch(query);
  const { data: recent } = useRecentFoods();
  const addFood = useAddFood(day);
  const resolve = useResolveBarcode();

  /**
   * A scan either lands straight on the portion step (found) or explains
   * itself. Silence after pointing a camera at a package is the one outcome
   * users cannot act on.
   */
  function handleBarcode(barcode: string) {
    setScanNote(null);
    resolve.mutate(barcode, {
      onSuccess: (result) => {
        if (result.status === 'catalogue' || result.status === 'imported') {
          setScanning(false);
          setSelected(result.food);
          setScanNote(
            result.status === 'imported' && result.missing.length > 0
              ? `Diimpor dari Open Food Facts. Data ${result.missing.join(', ')} belum ada — bisa kamu lengkapi nanti.`
              : null,
          );
          return;
        }
        setScanNote(
          result.status === 'not_found'
            ? 'Produk ini belum ada di database mana pun. Tambahkan manual saja.'
            : result.status === 'unusable'
              ? 'Produk ditemukan tapi data gizinya tidak lengkap. Tambahkan manual saja.'
              : result.status === 'invalid_barcode'
                ? 'Angka barcode tidak valid.'
                : 'Tidak ada koneksi ke database produk. Coba lagi nanti.',
        );
      },
    });
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const list = query.trim().length === 0 && recent?.length ? recent : (results ?? []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Tambah makanan untuk ${MEAL_LABEL[meal]}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl border border-ink-800 bg-ink-950 sm:rounded-3xl"
      >
        <header className="flex items-center justify-between border-b border-ink-800 p-4">
          <h2 className="font-semibold">
            {selected
              ? 'Berapa porsinya?'
              : scanning
                ? 'Pindai barcode'
                : `Tambah ke ${MEAL_LABEL[meal]}`}
          </h2>
          <button
            type="button"
            onClick={
              selected
                ? () => setSelected(null)
                : scanning
                  ? () => setScanning(false)
                  : onClose
            }
            className="rounded-lg px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-800"
          >
            {selected || scanning ? 'Kembali' : 'Tutup'}
          </button>
        </header>

        {scanning && !selected ? (
          <div className="overflow-y-auto p-4">
            <BarcodeScanner
              onDetected={handleBarcode}
              onCancel={() => setScanning(false)}
              busy={resolve.isPending}
            />
            {scanNote && (
              <p
                role="status"
                className="mt-3 rounded-xl bg-ink-900 p-3 text-sm text-ink-300"
              >
                {scanNote}
              </p>
            )}
          </div>
        ) : selected ? (
          <PortionStep
            food={selected}
            busy={addFood.isPending}
            error={addFood.error}
            onSubmit={(quantityG) =>
              addFood.mutate(
                { foodId: selected.id, loggedOn: day, meal, quantityG },
                { onSuccess: onClose },
              )
            }
          />
        ) : (
          <>
            <div className="p-4 pb-2">
              <div className="flex gap-2">
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari makanan… (mis. nasi, tempe, pisang)"
                  className={inputClass}
                  aria-label="Cari makanan"
                />
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  aria-label="Pindai barcode"
                  title="Pindai barcode"
                  className="shrink-0 rounded-xl border border-ink-700 px-3 text-ink-300 hover:bg-ink-800"
                >
                  <BarcodeGlyph />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {query.trim().length === 0 && recent && recent.length > 0 && (
                <p className="mb-2 text-xs font-medium tracking-wide text-ink-500 uppercase">
                  Sering kamu catat
                </p>
              )}

              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </div>
              ) : list.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-ink-500">
                    Tidak ada hasil untuk “{query}”.
                  </p>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-ink-500">
                    Kalau ini produk kemasan, barcode-nya biasanya lebih cepat
                    ketemu daripada namanya.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setScanning(true)}
                    className="mt-4 inline-flex"
                  >
                    <BarcodeGlyph />
                    Pindai barcode
                  </Button>
                </div>
              ) : (
                <ul className="space-y-1">
                  {list.map((food) => (
                    <li key={food.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(food)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-ink-900"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink-100">
                            {food.name}
                          </span>
                          <span className="block text-xs text-ink-500">
                            {Math.round(food.kcal)} kkal / 100{' '}
                            {food.isLiquid ? 'ml' : 'g'}
                            {food.servingLabel ? ` · ${food.servingLabel}` : ''}
                          </span>
                        </span>
                        <span aria-hidden="true" className="text-ink-500">
                          +
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PortionStep({
  food,
  busy,
  error,
  onSubmit,
}: {
  food: Food;
  busy: boolean;
  error: unknown;
  onSubmit: (quantityG: number) => void;
}) {
  const [amount, setAmount] = useState(String(defaultPortionG(food)));
  const quantity = Number(amount);
  const valid = Number.isFinite(quantity) && quantity > 0 && quantity <= 5000;

  const preview = useMemo(
    () => (valid ? nutrientsForQuantity(food, quantity) : null),
    [food, quantity, valid],
  );

  const unit = food.isLiquid ? 'ml' : 'g';
  const quickAmounts = food.servingG
    ? [food.servingG * 0.5, food.servingG, food.servingG * 2].map(Math.round)
    : [50, 100, 200];

  return (
    <form
      className="space-y-4 overflow-y-auto p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(quantity);
      }}
    >
      <div>
        <p className="font-medium text-ink-100">{food.name}</p>
        {food.brand && <p className="text-xs text-ink-500">{food.brand}</p>}
        {food.servingLabel && food.servingG && (
          <p className="text-xs text-ink-500">
            {food.servingLabel} ≈ {Math.round(food.servingG)} {unit}
          </p>
        )}
      </div>

      <Field label={`Jumlah (${unit})`}>
        <input
          type="number"
          inputMode="decimal"
          min={1}
          max={5000}
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
          autoFocus
        />
      </Field>

      <div className="flex gap-2">
        {quickAmounts.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setAmount(String(value))}
            className="flex-1 rounded-xl border border-ink-700 py-2 text-sm text-ink-300 hover:bg-ink-800"
          >
            {value} {unit}
          </button>
        ))}
      </div>

      {preview && (
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-ink-800 bg-ink-900 p-3 text-center">
          <Macro label="Kalori" value={formatKcal(preview.kcal)} />
          <Macro label="Protein" value={`${preview.proteinG.toFixed(1)} g`} />
          <Macro label="Karbo" value={`${preview.carbsG.toFixed(1)} g`} />
          <Macro label="Lemak" value={`${preview.fatG.toFixed(1)} g`} />
        </div>
      )}

      {error != null && (
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
          {error instanceof Error ? error.message : 'Gagal menyimpan'}
        </p>
      )}

      <Button type="submit" disabled={!valid || busy} className="w-full">
        {busy ? 'Menyimpan…' : 'Tambahkan'}
      </Button>
    </form>
  );
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="tabular text-sm font-semibold text-ink-100">{value}</p>
    </div>
  );
}

/** A barcode drawn as bars — no icon dependency for one glyph. */
function BarcodeGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <rect x="2" y="5" width="2" height="14" />
      <rect x="6" y="5" width="1" height="14" />
      <rect x="9" y="5" width="2" height="14" />
      <rect x="13" y="5" width="1" height="14" />
      <rect x="16" y="5" width="3" height="14" />
      <rect x="21" y="5" width="1" height="14" />
    </svg>
  );
}
