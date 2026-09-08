'use client';

import {
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  CATEGORY_TINT,
  FEATURED_CATEGORIES,
  type Food,
  type FoodCategory,
} from '@calorya/core';
import { useState } from 'react';
import { useFoodSearch, useRecentFoods } from '@/lib/hooks';
import { Card, SectionTitle, Skeleton } from './ui';

/**
 * Browsing the catalogue: search, six category tiles, and what you logged
 * last.
 *
 * This sits on the page rather than inside the add-food dialog. Finding the
 * food is the slow part of logging a meal, so it gets the screen; choosing the
 * portion is the fast part, and that is what the dialog is for.
 */
export function FoodBrowser({ onPick }: { onPick: (food: Food) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FoodCategory | null>(null);

  const trimmed = query.trim();
  const browsing = trimmed.length > 0 || category !== null;

  const { data: results, isLoading } = useFoodSearch(trimmed, category);
  const { data: recent } = useRecentFoods();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-ink-800 bg-ink-900 px-3 py-1">
        <SearchGlyph />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari makanan, contoh: nasi, ayam, apel…"
          aria-label="Cari makanan"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-ink-500"
        />
      </div>

      {browsing ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {category ? CATEGORY_LABEL[category] : `Hasil untuk “${trimmed}”`}
            </h2>
            <button
              type="button"
              onClick={() => {
                setCategory(null);
                setQuery('');
              }}
              className="text-sm font-medium text-brand-400"
            >
              Selesai
            </button>
          </div>

          {isLoading ? (
            <Skeleton className="h-40" />
          ) : (results ?? []).length === 0 ? (
            <Card>
              <p className="text-sm text-ink-500">
                Tidak ada hasil. Kalau ini produk kemasan, barcode-nya biasanya
                lebih cepat ketemu daripada namanya — tombol pindai ada di dalam
                “+ Tambah”.
              </p>
            </Card>
          ) : (
            <FoodList foods={results ?? []} onPick={onPick} />
          )}
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Kategori Populer</h2>
            <div className="grid grid-cols-3 gap-3">
              {FEATURED_CATEGORIES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-ink-800 bg-ink-900 px-2 py-3 transition-colors hover:border-brand-500"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
                    style={{ background: CATEGORY_TINT[key] }}
                  >
                    {CATEGORY_EMOJI[key]}
                  </span>
                  <span className="text-center text-[11px] leading-tight font-medium text-ink-300">
                    {CATEGORY_LABEL[key]}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {recent && recent.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Terakhir Dicatat</h2>
              <FoodList foods={recent.slice(0, 5)} onPick={onPick} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function FoodList({ foods, onPick }: { foods: Food[]; onPick: (food: Food) => void }) {
  return (
    <ul className="divide-y divide-ink-800 overflow-hidden rounded-2xl border border-ink-800">
      {foods.map((food) => (
        <li key={food.id}>
          <button
            type="button"
            onClick={() => onPick(food)}
            className="flex w-full items-center gap-3 bg-ink-900 px-3 py-3 text-left hover:bg-ink-800"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
              style={{ background: CATEGORY_TINT[food.category] }}
            >
              {CATEGORY_EMOJI[food.category]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{food.name}</span>
              <span className="tabular block text-xs text-ink-500">
                {Math.round(food.kcal)} kal / 100 {food.isLiquid ? 'ml' : 'g'}
                {food.servingLabel ? ` · ${food.servingLabel}` : ''}
              </span>
            </span>
            <span aria-hidden="true" className="text-lg text-brand-400">
              +
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SearchGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="shrink-0 text-ink-500"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}
