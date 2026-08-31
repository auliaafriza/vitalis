'use client';

import {
  defaultPortionG,
  formatKcal,
  MEAL_LABEL,
  nutrientsForQuantity,
  type Food,
  type MealType,
} from '@vitalis/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAddFood, useFoodSearch, useRecentFoods } from '@/lib/hooks';
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
  onClose,
}: {
  day: string;
  meal: MealType;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = useFoodSearch(query);
  const { data: recent } = useRecentFoods();
  const addFood = useAddFood(day);

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
            {selected ? 'Berapa porsinya?' : `Tambah ke ${MEAL_LABEL[meal]}`}
          </h2>
          <button
            type="button"
            onClick={selected ? () => setSelected(null) : onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-800"
          >
            {selected ? 'Kembali' : 'Tutup'}
          </button>
        </header>

        {selected ? (
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
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari makanan… (mis. nasi, tempe, pisang)"
                className={inputClass}
                aria-label="Cari makanan"
              />
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
                <p className="py-8 text-center text-sm text-ink-500">
                  Tidak ada hasil untuk “{query}”.
                </p>
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
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-ink-800 bg-ink-900/60 p-3 text-center">
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
