'use client';

import { formatVolume, waterEntrySchema } from '@calorya/core';
import { useEffect, useState } from 'react';
import { useAddWater } from '@/lib/hooks';
import { ErrorNote, inputClass, Spinner } from './ui';

/**
 * Logging a glass of water: the usual sizes, plus any amount at all.
 *
 * The fixed buttons cover the common cases and nothing else, which is fine
 * until your bottle is 600 ml, or the glass is 180, or you finished half a
 * litre and want to log 250. Before this there was no way to say so — the only
 * options were to log the wrong number or not log it.
 *
 * The mobile app has a mirror of this file. They are two files because React
 * Native and the DOM cannot share a component, but they agree on the amounts,
 * the storage key and the validation, all of which come from @calorya/core.
 */

/** The default sizes: a small glass, a big glass, a mug, a small bottle. */
export const QUICK_WATER_ML = [150, 250, 350, 500] as const;

/**
 * Where the last custom amount is remembered.
 *
 * A custom option that has to be retyped every day is a chore, not a feature —
 * someone with a 600 ml bottle drinks from it several times a day. Remembering
 * the last one turns the second use onwards back into one click.
 */
const LAST_CUSTOM_KEY = 'calorya.water.custom.v1';

export function WaterQuickAdd({
  day,
  amounts = QUICK_WATER_ML,
}: {
  day: string;
  amounts?: readonly number[];
}) {
  const addWater = useAddWater(day);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<number | null>(null);

  useEffect(() => {
    // Read in an effect, not during render: localStorage does not exist while
    // this page is being rendered on the server.
    try {
      const raw = window.localStorage.getItem(LAST_CUSTOM_KEY);
      if (raw === null) return;
      const value = Number(raw);
      if (Number.isInteger(value) && value > 0) setRemembered(value);
    } catch {
      // Private browsing, or site data blocked. A remembered shortcut is a
      // convenience; losing it must not take the rest of the card with it.
    }
  }, []);

  function log(amountMl: number) {
    addWater.mutate({ loggedOn: day, amountMl });
  }

  function submitCustom() {
    const parsed = waterEntrySchema.shape.amountMl.safeParse(draft.trim());
    if (!parsed.success) {
      // The schema owns the wording ("Sekali catat maksimal 3000 ml"), so the
      // limit is stated once and cannot drift from what the database accepts.
      setInvalid(parsed.error.issues[0]?.message ?? 'Jumlah tidak valid');
      return;
    }

    const amountMl = parsed.data;
    setInvalid(null);
    log(amountMl);
    setDraft('');
    setOpen(false);

    if (!amounts.includes(amountMl)) {
      setRemembered(amountMl);
      try {
        window.localStorage.setItem(LAST_CUSTOM_KEY, String(amountMl));
      } catch {
        // See above.
      }
    }
  }

  const showRemembered = remembered !== null && !amounts.includes(remembered);
  const busy = (ml: number) => addWater.isPending && addWater.variables?.amountMl === ml;

  const chipClass =
    'inline-flex items-center justify-center rounded-xl border border-water/40 bg-water/10 py-2.5 text-sm font-medium text-water disabled:opacity-50';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {amounts.map((ml) => (
          <button
            key={ml}
            type="button"
            disabled={addWater.isPending}
            aria-busy={busy(ml) || undefined}
            onClick={() => log(ml)}
            className={chipClass}
          >
            {busy(ml) ? <Spinner className="h-4 w-4" /> : `+${ml}`}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {showRemembered ? (
          <button
            type="button"
            disabled={addWater.isPending}
            aria-busy={busy(remembered) || undefined}
            onClick={() => log(remembered)}
            className={`flex-1 ${chipClass}`}
          >
            {busy(remembered) ? <Spinner className="h-4 w-4" /> : `+${remembered}`}
          </button>
        ) : null}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen((was) => !was);
            setInvalid(null);
          }}
          className={`flex-1 rounded-xl border border-dashed py-2.5 text-sm ${
            open
              ? 'border-water text-water'
              : 'border-ink-700 text-ink-500 hover:bg-ink-800'
          }`}
        >
          {open ? 'Tutup' : 'Jumlah lain…'}
        </button>
      </div>

      {open ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submitCustom();
          }}
        >
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={3000}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setInvalid(null);
              }}
              placeholder="600"
              className={`${inputClass} pr-10`}
              aria-label="Jumlah air dalam mililiter"
              autoFocus
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-500">
              ml
            </span>
          </div>
          <button
            type="submit"
            disabled={draft.trim().length === 0 || addWater.isPending}
            className="rounded-xl bg-water px-4 py-2.5 text-sm font-medium text-ink-950 disabled:opacity-50"
          >
            Catat
          </button>
        </form>
      ) : null}

      {invalid ? <p className="text-xs text-red-400">{invalid}</p> : null}
      {addWater.error != null ? <ErrorNote error={addWater.error} /> : null}

      {showRemembered && !open ? (
        <p className="text-xs text-ink-500">
          {formatVolume(remembered)} disimpan dari catatan terakhirmu.
        </p>
      ) : null}
    </div>
  );
}
