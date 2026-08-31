'use client';

import type { ReactNode } from 'react';

/** Shared presentational primitives. Deliberately small and unstyled-ish. */

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <Tag
      className={`rounded-2xl border border-ink-800 bg-ink-900/60 p-4 backdrop-blur ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-ink-300 uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm' };
  const variants = {
    primary: 'bg-brand-500 text-ink-950 hover:bg-brand-400',
    ghost: 'border border-ink-700 text-ink-100 hover:bg-ink-800',
    danger: 'text-red-300 hover:bg-red-500/10',
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-300">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 text-ink-100 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none';

/**
 * Circular progress indicator.
 *
 * The value is announced to screen readers as text; the ring itself is
 * aria-hidden, because a decorative SVG that reads out its path data is worse
 * than no SVG at all.
 */
export function ProgressRing({
  value,
  max,
  size = 120,
  stroke = 10,
  color = 'var(--color-brand-500)',
  label,
  center,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  center?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} aria-hidden="true" className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ink-800)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={over ? 'var(--color-body)' : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {center}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Horizontal progress bar for the macro rows. */
export function ProgressBar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      className="h-2 w-full overflow-hidden rounded-full bg-ink-800"
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${ratio * 100}%`,
          background: over ? 'var(--color-body)' : color,
        }}
      />
    </div>
  );
}

export function StatTile({
  label,
  value,
  unit,
  hint,
  accent = 'var(--color-brand-500)',
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-3">
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={{ background: accent }}
        />
        <span className="text-xs font-medium text-ink-500">{label}</span>
      </div>
      <p className="tabular mt-1.5 text-xl font-semibold text-ink-100">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ink-500">{unit}</span>}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-800 p-8 text-center">
      <p className="font-medium text-ink-300">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-ink-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-ink-800/70 ${className}`}
    />
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
    >
      {message}
    </div>
  );
}
