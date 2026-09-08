'use client';

import { useTheme, type ThemeChoice } from '@/lib/theme';

/**
 * Light, dark, or whatever the device says.
 *
 * "Ikuti perangkat" is a real third option rather than a resolved value: a
 * phone that switches at sunset should keep switching, and collapsing that
 * into whichever theme happens to be active right now would quietly stop it.
 */
const OPTIONS: readonly { value: ThemeChoice; label: string; hint: string }[] = [
  { value: 'light', label: 'Terang', hint: '☀' },
  { value: 'dark', label: 'Gelap', hint: '☾' },
  { value: 'system', label: 'Ikuti perangkat', hint: '⌘' },
];

export function ThemePicker() {
  const { choice, setChoice } = useTheme();

  return (
    <div role="radiogroup" aria-label="Tema tampilan" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((option) => {
        const active = choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setChoice(option.value)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${
              active
                ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                : 'border-ink-800 text-ink-500 hover:text-ink-300'
            }`}
          >
            <span aria-hidden="true" className="text-base">
              {option.hint}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
