'use client';

import { setTutorialSeen } from '@calorya/api';
import {
  TUTORIAL_LAST_LABEL,
  TUTORIAL_NEXT_LABEL,
  TUTORIAL_SKIP_LABEL,
  TUTORIAL_STEPS,
} from '@calorya/core';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { getBrowserClient } from '@/lib/supabase/client';

/**
 * The five-slide introduction, shown once per account.
 *
 * Deliberately outside the (app) shell: no bottom navigation, no sidebar,
 * nothing to wander off into. The shell is what sends people here, and the
 * only two ways out — finishing and skipping — both stamp the same column, so
 * neither can leave someone stuck in a loop.
 *
 * Whether the stamp succeeds is not allowed to block the exit. If the write
 * fails (offline, expired token) the user still leaves; the worst case is
 * seeing the slides again next time, which is a far smaller failure than being
 * trapped on a page whose only button does nothing.
 */
export default function TutorialPage() {
  return (
    <Suspense fallback={null}>
      <Tutorial />
    </Suspense>
  );
}

function Tutorial() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step = TUTORIAL_STEPS[index]!;
  const isLast = index === TUTORIAL_STEPS.length - 1;

  // Moving between slides swaps the whole panel, which a screen reader would
  // otherwise announce as nothing at all — the focus stays on a button whose
  // label did not change. Sending focus to the new heading makes the change
  // audible, in the same way it is visible.
  useEffect(() => {
    if (index > 0) headingRef.current?.focus();
  }, [index]);

  async function leave() {
    setLeaving(true);
    try {
      await setTutorialSeen(getBrowserClient(), true);
    } catch {
      // Intentionally swallowed — see the note above.
    }
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-5 py-8">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold tracking-[0.18em] text-brand-400 uppercase">
          Calorya
        </p>
        <button
          type="button"
          onClick={leave}
          disabled={leaving}
          className="text-sm text-ink-500 underline underline-offset-4 hover:text-ink-300 disabled:opacity-50"
        >
          {TUTORIAL_SKIP_LABEL}
        </button>
      </div>

      {/* Progress as dots rather than a bar: five is few enough to count, and
          a dot you can click is also the way back to a slide you read too fast. */}
      <div className="mt-6 flex gap-2" role="tablist" aria-label="Langkah tutorial">
        {TUTORIAL_STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Langkah ${i + 1}: ${s.title}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= index ? 'bg-brand-500' : 'bg-ink-800'
            }`}
          />
        ))}
      </div>

      <div className="mt-10 flex flex-1 flex-col">
        <span
          aria-hidden="true"
          style={{ background: step.tint }}
          className="flex h-20 w-20 items-center justify-center rounded-3xl text-4xl"
        >
          {step.emoji}
        </span>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-2xl font-semibold outline-none"
        >
          {step.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">{step.body}</p>

        <ul className="mt-5 space-y-2">
          {step.points.map((point) => (
            <li key={point} className="flex gap-2.5 text-sm text-ink-300">
              <span aria-hidden="true" className="text-brand-400">
                •
              </span>
              {point}
            </li>
          ))}
        </ul>

        {step.where && (
          <p className="mt-5 rounded-xl bg-ink-900 px-3 py-2.5 text-xs text-ink-500">
            Ada di <span className="text-ink-300">{step.where.web}</span>.
          </p>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {index > 0 && (
          <Button
            variant="ghost"
            onClick={() => setIndex((i) => i - 1)}
            className="px-4"
          >
            Kembali
          </Button>
        )}
        <Button
          onClick={() => (isLast ? leave() : setIndex((i) => i + 1))}
          disabled={leaving}
          className="flex-1"
        >
          {isLast ? TUTORIAL_LAST_LABEL : TUTORIAL_NEXT_LABEL}
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-ink-500">
        {index + 1} dari {TUTORIAL_STEPS.length}
      </p>
    </main>
  );
}
