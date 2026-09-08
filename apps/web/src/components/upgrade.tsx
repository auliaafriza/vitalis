'use client';

import type { ReactNode } from 'react';
import { Button, Card } from './ui';

/**
 * The premium prompts.
 *
 * These explain a limit the database already enforces — removing them would
 * not unlock anything, it would only leave the user confused about why a chart
 * stops. So the copy says what premium gives, never scolds, and always leaves
 * the free experience fully usable.
 */

export function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

export function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/12 px-2 py-0.5 text-[11px] font-medium text-brand-400">
      <LockIcon />
      Premium
    </span>
  );
}

/**
 * Shown in place of content the current plan cannot reach.
 * `preview` lets the caller show a blurred or shortened version behind it —
 * seeing what you are missing converts far better than a bare padlock.
 */
export function UpgradeCard({
  title,
  description,
  preview,
  onDismiss,
}: {
  title: string;
  description: string;
  preview?: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <Card className="relative overflow-hidden">
      {preview && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-25 blur-[3px]"
        >
          {preview}
        </div>
      )}

      <div className="relative flex flex-col items-center gap-3 py-4 text-center">
        <PremiumBadge />
        <div>
          <p className="font-medium text-ink-100">{title}</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-500">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => alert('Halaman langganan belum dibuat.')}>
            Lihat Premium
          </Button>
          {onDismiss && (
            <Button type="button" variant="ghost" onClick={onDismiss}>
              Nanti saja
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
