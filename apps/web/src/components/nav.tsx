'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { relativeDayLabel } from '@vitalis/core';

const TABS = [
  { href: '/dashboard', label: 'Beranda', icon: '◎' },
  { href: '/nutrition', label: 'Nutrisi', icon: '🍽' },
  { href: '/health', label: 'Kesehatan', icon: '♡' },
  { href: '/trends', label: 'Tren', icon: '📈' },
  { href: '/settings', label: 'Profil', icon: '⚙' },
] as const;

/** Bottom tab bar on phones, left rail from `md` upward. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-800 bg-ink-950/95 backdrop-blur md:inset-y-0 md:right-auto md:w-56 md:border-t-0 md:border-r"
    >
      <div className="mx-auto flex max-w-lg items-stretch md:h-full md:max-w-none md:flex-col md:gap-1 md:p-3">
        <p className="hidden px-3 py-4 text-lg font-semibold text-brand-400 md:block">
          Vitalis
        </p>
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] transition-colors md:flex-none md:flex-row md:gap-3 md:rounded-xl md:px-3 md:py-2.5 md:text-sm ${
                active
                  ? 'text-brand-400 md:bg-ink-900'
                  : 'text-ink-500 hover:text-ink-300'
              }`}
              style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
            >
              <span aria-hidden="true" className="text-lg leading-none md:text-base">
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Previous / next day selector shown at the top of the logging screens. */
export function DayNav({
  selected,
  today,
  canGoForward,
  onPrevious,
  onNext,
  onToday,
}: {
  selected: string;
  today: string;
  canGoForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Hari sebelumnya"
        className="rounded-lg px-3 py-2 text-ink-300 hover:bg-ink-800"
      >
        ‹
      </button>

      <button
        type="button"
        onClick={onToday}
        className="min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-center text-sm font-medium text-ink-100 hover:bg-ink-800"
      >
        {relativeDayLabel(selected, today)}
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={!canGoForward}
        aria-label="Hari berikutnya"
        className="rounded-lg px-3 py-2 text-ink-300 hover:bg-ink-800 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        ›
      </button>
    </div>
  );
}
