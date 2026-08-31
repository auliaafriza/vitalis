'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * React Query does the caching, retry and revalidation that a tracker needs:
 * open the app, see yesterday's numbers instantly from cache, then watch them
 * refresh. staleTime is generous because health data changes only when the
 * user changes it.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 24 * 60 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // A failed registration must never break the app — it only means no
        // offline shell for this visit.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
