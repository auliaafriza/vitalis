import { shouldSyncSteps, todayKey, totalStepsToday } from '@calorya/core';
import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useSaveSteps, useSteps } from './hooks';

/**
 * Reads today's step count from the device pedometer and syncs it upward.
 *
 * This is the one capability the PWA cannot match, and it was quietly broken
 * on every Android build. Three separate faults, all of which only showed up
 * once the app left Expo Go:
 *
 *   1. `Pedometer.getStepCountAsync` is an **iOS-only** API. Expo's Android
 *      module implements it as `throw NotSupportedException(...)`. The old
 *      code called it unconditionally, so on Android the very first thing it
 *      did was throw, set an error, and leave the count at null.
 *
 *   2. `watchStepCount` reports steps *cumulatively since the subscription
 *      began*, not one event's worth. The old code did
 *      `setSteps(prev => prev + result.steps)`, which turns a walk reporting
 *      1, 2, 3 into 1 + 3 + 6 = 10 — a number that grows quadratically with
 *      how long you walk.
 *
 *   3. The write-back throttle *dropped* updates inside its one-minute window
 *      instead of deferring them, so the last minute of any walk never
 *      reached the database. Close the app after a stroll and the steps were
 *      simply gone.
 *
 * What Android genuinely cannot do is tell us about steps taken while the app
 * was closed — its sensor only counts while something is listening, and the
 * historical query belongs to Health Connect, a much larger dependency. So
 * the honest design is: start from what was already saved for today, add what
 * this session sees, and say plainly in the UI that the phone only counts
 * while Calorya is open. `limited` is what the screen reads to say that.
 */
export function usePedometer(timezone: string, enabled = true) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const day = todayKey(timezone);
  const saveSteps = useSaveSteps(day);
  /**
   * What is already recorded for today.
   *
   * On Android this is the only memory of steps taken before the app was
   * opened, so it is the baseline the session count is added to.
   */
  const { data: stored } = useSteps(day);

  const sessionSteps = useRef(0);
  const baseline = useRef<number | null>(null);
  const lastSynced = useRef({ lastValue: 0, lastAt: 0 });

  /**
   * Held in a ref as well as in state so the unmount flush can read the final
   * value. An effect cleanup closes over the state from the render that
   * created it, which by definition is not the last one.
   */
  const latestSteps = useRef<number | null>(null);

  const sync = useCallback(
    (value: number, force: boolean) => {
      const now = Date.now();
      if (!shouldSyncSteps(value, lastSynced.current, now, { force })) return;
      lastSynced.current = { lastValue: value, lastAt: now };
      saveSteps.mutate({ loggedOn: day, steps: value, source: 'pedometer' });
    },
    // `saveSteps` is a fresh object every render; depending on it would make
    // this callback — and every effect below — churn on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day],
  );

  // --- Availability, permission, and the iOS-only head start ----------------
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const isAvailable = await Pedometer.isAvailableAsync();
        if (cancelled) return;
        setAvailable(isAvailable);
        if (!isAvailable) {
          setError('Perangkat ini tidak punya sensor langkah.');
          return;
        }

        const permission = await Pedometer.requestPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) {
          setError(
            permission.canAskAgain === false
              ? 'Izin data aktivitas ditolak. Aktifkan lewat Pengaturan aplikasi kalau ingin langkah terisi otomatis.'
              : 'Izin data aktivitas ditolak.',
          );
          return;
        }

        setError(null);

        /*
         * Only iOS can be asked "how many steps since midnight?". Calling this
         * on Android is not a degraded experience, it is an exception — so it
         * is not called there at all.
         */
        if (Platform.OS === 'ios') {
          const start = new Date(`${day}T00:00:00`);
          const result = await Pedometer.getStepCountAsync(start, new Date());
          if (cancelled) return;
          baseline.current = result.steps;
        } else {
          baseline.current = stored?.steps ?? 0;
        }

        const total = totalStepsToday(baseline.current ?? 0, sessionSteps.current);
        latestSteps.current = total;
        setSteps(total);
      } catch (err) {
        if (cancelled) return;
        // Whatever went wrong, the session counter below can still work, so
        // fall back to it rather than giving up on steps entirely.
        baseline.current = stored?.steps ?? 0;
        setError(err instanceof Error ? err.message : 'Sensor langkah tidak tersedia.');
      }
    })();

    return () => {
      cancelled = true;
    };
    // `stored` is deliberately excluded: the baseline must be captured once,
    // not re-read every time the query refetches, or our own writes would be
    // added back on top of themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, enabled]);

  // --- The live counter ------------------------------------------------------
  useEffect(() => {
    if (!enabled || available !== true) return;

    // A new subscription restarts the platform's session counter at zero, so
    // ours has to restart with it.
    sessionSteps.current = 0;

    const subscription = Pedometer.watchStepCount((result) => {
      // `result.steps` is the running total since this subscription began —
      // assign it, never add it.
      sessionSteps.current = result.steps;
      const total = totalStepsToday(baseline.current ?? 0, result.steps);
      latestSteps.current = total;
      setSteps(total);
      sync(total, false);
    });

    return () => subscription.remove();
  }, [available, enabled, sync]);

  /*
   * Flush on the way out.
   *
   * Both of these are the same fix for the same complaint: steps that were
   * counted but never saved. Leaving the app foreground is the common case;
   * unmounting covers a tab change or the day rolling over.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && latestSteps.current !== null) {
        sync(latestSteps.current, true);
      }
    });
    return () => subscription.remove();
  }, [sync]);

  useEffect(
    () => () => {
      if (latestSteps.current !== null) sync(latestSteps.current, true);
    },
    [sync],
  );

  return {
    available,
    steps,
    error,
    /**
     * True when the count only covers time spent inside the app — which is
     * every Android device. The screen says so rather than letting the number
     * look like a full day's total.
     */
    limited: Platform.OS !== 'ios',
  };
}
