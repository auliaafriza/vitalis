'use client';

import { useState, type ReactNode } from 'react';

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
      className={`rounded-2xl border border-ink-800 card-shadow bg-ink-900 p-4 ${className}`}
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
    <div className="rounded-2xl border border-ink-800 bg-ink-900 p-3">
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

/**
 * A yes/no question the user must answer before something irreversible runs.
 *
 * Not `window.confirm`: it cannot show a pending state, cannot show the error
 * when the action fails, and is blocked outright by some browsers inside an
 * installed PWA — which is exactly where this app runs.
 *
 * `busy` holds the dialog open with both buttons disabled while the work is in
 * flight, so the question is never answered twice, and `error` renders in
 * place instead of vanishing with the dialog.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
      // Clicking the backdrop answers "no" — but not mid-flight, or the
      // dialog would disappear while the sign-out is still running.
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-2xl border border-ink-800 bg-ink-900 p-5 shadow-xl"
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm leading-relaxed text-ink-300">{message}</p>

        {error != null && <ErrorNote error={error} />}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          {/*
            Solid red with white text, not the text-only `danger` variant used
            in lists: at dialog size that variant renders pale red on a pale
            surface and the confirm button is the one thing here that must be
            unmistakable. Explicit colours rather than theme tokens, because
            red-600/white clears contrast in both themes.
          */}
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onConfirm}
            className={`flex-1 ${
              destructive
                ? 'border-transparent bg-red-600 text-white hover:bg-red-500'
                : 'border-transparent bg-brand-500 text-ink-950 hover:bg-brand-400'
            }`}
          >
            {busy ? 'Memproses…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-ink-800 ${className}`}
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

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.7a3 3 0 0 0 4.2 4.2" />
      <path d="M9.7 5.7A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3.3 4.2" />
      <path d="M6.5 6.9A17.4 17.4 0 0 0 2.5 12S6 18.5 12 18.5a9.8 9.8 0 0 0 4-.85" />
    </svg>
  );
}

export function PasswordInput({
  value,
  onChange,
  autoComplete = 'current-password',
  placeholder = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022',
  required,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  name?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        name={name}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        onMouseDown={(e) => e.preventDefault()}
        aria-pressed={visible}
        aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        title={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-ink-500 transition-colors hover:text-ink-100"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

/**
 * The pill row on Progress: Kalori · Berat Badan · Nutrisi.
 *
 * A radiogroup rather than tabs: it selects which measure to look at, it does
 * not switch between panels of unrelated content, and screen readers announce
 * "3 of 3 selected" rather than a tab list the user cannot arrow through.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-full bg-ink-800 p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              active ? 'bg-ink-900 text-ink-100 shadow-sm' : 'text-ink-500 hover:text-ink-300'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
