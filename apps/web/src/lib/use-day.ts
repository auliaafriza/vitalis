'use client';

import { addDays, todayKey } from '@calorya/core';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * The day the UI is currently showing, in the user's own timezone.
 *
 * The timezone is read from the browser rather than assumed, and the "today"
 * value is recomputed on focus so an app left open overnight does not keep
 * logging into yesterday — a bug that is invisible in testing and obvious to
 * anyone who uses the app for a week.
 */
export function useDay(timezone?: string) {
  const tz = useMemo(
    () => timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jakarta',
    [timezone],
  );

  const [today, setToday] = useState(() => todayKey(tz));
  const [selected, setSelected] = useState(today);

  useEffect(() => {
    const refresh = () => {
      const current = todayKey(tz);
      setToday((previous) => {
        if (previous === current) return previous;
        // Follow the rollover only if the user was looking at "today".
        setSelected((sel) => (sel === previous ? current : sel));
        return current;
      });
    };

    refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [tz]);

  const goToPreviousDay = useCallback(() => setSelected((d) => addDays(d, -1)), []);
  const goToNextDay = useCallback(
    () => setSelected((d) => (d >= today ? d : addDays(d, 1))),
    [today],
  );
  const goToToday = useCallback(() => setSelected(today), [today]);

  return {
    timezone: tz,
    today,
    selected,
    setSelected,
    isToday: selected === today,
    canGoForward: selected < today,
    goToPreviousDay,
    goToNextDay,
    goToToday,
  };
}
