import { todayKey } from '@calorya/core';
import { Pedometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { useSaveSteps } from './hooks';

/**
 * Reads today's step count from the device pedometer and syncs it upward.
 *
 * This is the one capability the PWA cannot match, so it is worth doing
 * properly: permission is requested explicitly, the count is written at most
 * once a minute (not on every sensor tick, which would hammer the database),
 * and an unavailable sensor degrades to manual entry rather than an error.
 */
export function usePedometer(timezone: string, enabled = true) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const day = todayKey(timezone);
  const saveSteps = useSaveSteps(day);
  const lastSynced = useRef<{ value: number; at: number }>({ value: -1, at: 0 });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const isAvailable = await Pedometer.isAvailableAsync();
        if (cancelled) return;
        setAvailable(isAvailable);
        if (!isAvailable) return;

        const permission = await Pedometer.requestPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) {
          setError('Izin data aktivitas ditolak');
          return;
        }

        // Midnight in the user's timezone, expressed as an instant.
        const start = new Date(`${day}T00:00:00`);
        const result = await Pedometer.getStepCountAsync(start, new Date());
        if (cancelled) return;
        setSteps(result.steps);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Pedometer tidak tersedia');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [day, enabled]);

  useEffect(() => {
    if (!enabled || available !== true) return;

    const subscription = Pedometer.watchStepCount((result) => {
      setSteps((previous) => (previous ?? 0) + result.steps);
    });

    return () => subscription.remove();
  }, [available, enabled]);

  // Throttled write-back: at most once a minute, and only on a real change.
  useEffect(() => {
    if (steps === null) return;
    const now = Date.now();
    const { value, at } = lastSynced.current;
    if (steps === value) return;
    if (now - at < 60_000) return;

    lastSynced.current = { value: steps, at: now };
    saveSteps.mutate({ loggedOn: day, steps, source: 'pedometer' });
  }, [steps, day, saveSteps]);

  return { available, steps, error };
}
