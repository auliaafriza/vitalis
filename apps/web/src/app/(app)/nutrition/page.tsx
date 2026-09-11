'use client';

import { groupByMeal } from '@calorya/api';
import {
  addDays,
  formatKcal,
  macroSplit,
  MEAL_EMOJI,
  MEAL_LABEL,
  mealForHour,
  sumNutrients,
  type Food,
  type MealType,
} from '@calorya/core';
import { useMemo, useState } from 'react';
import { FoodBrowser } from '@/components/food-browser';
import { FoodPicker } from '@/components/food-picker';
import { DayNav } from '@/components/nav';
import {
  Card,
  EmptyState,
  ErrorNote,
  ProgressBar,
  SectionTitle,
  Skeleton,
  Spinner,
} from '@/components/ui';
import {
  useCopyMeal,
  useDeleteFood,
  useFoodEntries,
  useProfile,
  useTargets,
  useUpdateFoodQuantity,
} from '@/lib/hooks';
import { useDay } from '@/lib/use-day';

export default function NutritionPage() {
  const { data: profile } = useProfile();
  const day = useDay(profile?.timezone);
  const [picking, setPicking] = useState<MealType | null>(null);
  const [chosen, setChosen] = useState<Food | null>(null);

  /**
   * Which meal a food picked from the browser goes to.
   *
   * Guessed from the clock rather than asked: at 12:40 almost nobody is
   * logging breakfast, and the dialog still shows the meal so a wrong guess
   * costs one tap — while asking every time costs one tap always.
   */
  function pickFood(food: Food) {
    setChosen(food);
    setPicking(mealForHour(new Date().getHours()));
  }

  const { data: entries, isLoading, error } = useFoodEntries(day.selected);
  const { data: targets } = useTargets(day.selected);
  const deleteFood = useDeleteFood(day.selected);
  const updateQuantity = useUpdateFoodQuantity(day.selected);

  /**
   * Repeating yesterday, offered only where a meal is still empty: copying
   * into a meal that already has entries is how people end up eating lunch
   * twice on paper.
   */
  const copyMeal = useCopyMeal(day.selected);
  const yesterday = addDays(day.selected, -1);
  /** The meal whose copy found nothing — said out loud instead of no-op. */
  const [nothingToCopy, setNothingToCopy] = useState<MealType | null>(null);
  /** id of the entry whose portion is being corrected inline. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draftQuantity, setDraftQuantity] = useState('');

  const groups = useMemo(() => groupByMeal(entries ?? []), [entries]);
  const totals = useMemo(() => sumNutrients(entries ?? []), [entries]);
  const split = useMemo(() => macroSplit(totals), [totals]);

  if (error) return <ErrorNote error={error} />;

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold">Catat Makanan</h1>
          <p className="mt-1 text-sm text-ink-500">
            Cari atau pindai makanan, langsung lihat informasi kalorinya.
          </p>
        </div>
        <DayNav
          selected={day.selected}
          today={day.today}
          canGoForward={day.canGoForward}
          onPrevious={day.goToPreviousDay}
          onNext={day.goToNextDay}
          onToday={day.goToToday}
        />
      </header>

      <FoodBrowser onPick={pickFood} />

      <Card>
        <div className="flex items-baseline justify-between">
          <span className="tabular text-2xl font-semibold">
            {formatKcal(totals.kcal)}
          </span>
          {targets && (
            <span className="text-sm text-ink-500">dari {targets.kcal} kkal</span>
          )}
        </div>
        {targets && (
          <div className="mt-3">
            <ProgressBar
              value={totals.kcal}
              max={targets.kcal}
              color="var(--color-food)"
              label="Kalori harian"
            />
          </div>
        )}

        {totals.kcal > 0 && (
          <>
            <div
              className="mt-4 flex h-2 overflow-hidden rounded-full"
              role="img"
              aria-label={`Komposisi kalori: protein ${split.protein}%, karbohidrat ${split.carbs}%, lemak ${split.fat}%`}
            >
              <span style={{ width: `${split.protein}%`, background: 'var(--color-body)' }} />
              <span style={{ width: `${split.carbs}%`, background: 'var(--color-move)' }} />
              <span style={{ width: `${split.fat}%`, background: 'var(--color-sleep)' }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-ink-500">
              <span>Protein {split.protein}%</span>
              <span>Karbo {split.carbs}%</span>
              <span>Lemak {split.fat}%</span>
            </div>
          </>
        )}
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.meal}>
            <SectionTitle
              action={
                <button
                  type="button"
                  onClick={() => setPicking(group.meal)}
                  className="text-sm font-medium text-brand-400"
                >
                  + Tambah
                </button>
              }
            >
              <span aria-hidden="true" className="mr-1">
                {MEAL_EMOJI[group.meal]}
              </span>
              {MEAL_LABEL[group.meal]}
              {group.entries.length > 0 && (
                <span className="tabular ml-2 font-normal text-ink-500 normal-case">
                  {formatKcal(group.totals.kcal)}
                </span>
              )}
            </SectionTitle>

            {group.entries.length === 0 ? (
              <EmptyState
                title="Belum ada catatan"
                description={
                  nothingToCopy === group.meal
                    ? `Kemarin juga tidak ada catatan ${MEAL_LABEL[group.meal].toLowerCase()}.`
                    : `Tambahkan apa yang kamu makan saat ${MEAL_LABEL[group.meal].toLowerCase()}.`
                }
                action={
                  <button
                    type="button"
                    disabled={copyMeal.isPending}
                    aria-busy={
                      (copyMeal.isPending && copyMeal.variables?.meal === group.meal) ||
                      undefined
                    }
                    onClick={() => {
                      setNothingToCopy(null);
                      copyMeal.mutate(
                        { from: yesterday, meal: group.meal },
                        {
                          onSuccess: (copied) => {
                            if (copied.length === 0) setNothingToCopy(group.meal);
                          },
                        },
                      );
                    }}
                    className="rounded-xl border border-ink-700 px-3 py-2 text-sm font-medium text-ink-300 hover:border-brand-500 hover:text-brand-400 disabled:opacity-50"
                  >
                    ⟲ Salin dari kemarin
                  </button>
                }
              />
            ) : (
              <ul className="divide-y divide-ink-800 overflow-hidden rounded-2xl border border-ink-800">
                {group.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 bg-ink-900 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-100">
                        {entry.foodName}
                      </p>
                      {editing === entry.id ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            const quantityG = Number(draftQuantity);
                            if (!Number.isFinite(quantityG) || quantityG <= 0) return;
                            updateQuantity.mutate(
                              { id: entry.id, quantityG },
                              { onSuccess: () => setEditing(null) },
                            );
                          }}
                          className="mt-1 flex items-center gap-2"
                        >
                          <input
                            type="number"
                            value={draftQuantity}
                            onChange={(event) => setDraftQuantity(event.target.value)}
                            autoFocus
                            min={1}
                            max={5000}
                            aria-label={`Porsi ${entry.foodName} dalam gram`}
                            className="w-24 rounded-lg border border-ink-700 bg-ink-950 px-2 py-1 text-sm"
                          />
                          <span className="text-xs text-ink-500">g</span>
                          <button
                            type="submit"
                            disabled={updateQuantity.isPending}
                            aria-busy={updateQuantity.isPending || undefined}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 disabled:opacity-60"
                          >
                            {updateQuantity.isPending ? (
                              <Spinner className="h-3 w-3" />
                            ) : null}
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="text-xs text-ink-500"
                          >
                            Batal
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(entry.id);
                            setDraftQuantity(String(Math.round(entry.quantityG)));
                          }}
                          className="tabular text-left text-xs text-ink-500 underline decoration-dotted underline-offset-4 hover:text-ink-300"
                        >
                          {Math.round(entry.quantityG)} g · P {entry.proteinG.toFixed(0)} ·
                          K {entry.carbsG.toFixed(0)} · L {entry.fatG.toFixed(0)}
                        </button>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular text-sm text-ink-300">
                        {Math.round(entry.kcal)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Hapus ${entry.foodName}`}
                        onClick={() => deleteFood.mutate(entry.id)}
                        disabled={deleteFood.isPending}
                        aria-busy={
                          (deleteFood.isPending && deleteFood.variables === entry.id) ||
                          undefined
                        }
                        className="inline-flex items-center rounded-lg px-2 py-1 text-ink-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"
                      >
                        {deleteFood.isPending && deleteFood.variables === entry.id ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          '×'
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}

      {picking && (
        <FoodPicker
          day={day.selected}
          meal={picking}
          initialFood={chosen}
          onClose={() => {
            setPicking(null);
            setChosen(null);
          }}
        />
      )}
    </div>
  );
}
