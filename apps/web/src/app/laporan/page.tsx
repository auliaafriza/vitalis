import type { Metadata } from 'next';
import { Suspense } from 'react';
import Report from './report';

export const metadata: Metadata = {
  title: 'Laporan — Calorya',
  robots: { index: false, follow: false },
};

/**
 * `useSearchParams` opts the tree into client-side rendering, so the report
 * itself must sit behind a Suspense boundary or the build fails on
 * prerendering. The fallback is deliberately plain — it exists for a few
 * milliseconds and must not print.
 */
export default function LaporanPage() {
  return (
    <Suspense
      fallback={
        <main className="report mx-auto max-w-3xl px-8 py-10 text-[12px]">
          Menyiapkan laporan…
        </main>
      }
    >
      <Report />
    </Suspense>
  );
}
