'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/**
 * Theme choice.
 *
 * Three states, not two: 'system' is a real answer, and collapsing it into
 * whichever theme happens to be active right now would silently stop following
 * the phone's sunset switch.
 */
export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'calorya-theme';

/**
 * Runs before React hydrates, injected into <head> by the root layout.
 *
 * It has to be a blocking inline script rather than an effect: an effect runs
 * after the first paint, so a user who chose dark would see a white flash on
 * every navigation. Written as a string because it must exist before any
 * bundle loads.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {
    /* private mode, or storage blocked — fall through to the media query */
  }
})();
`;

interface ThemeContextValue {
  choice: ThemeChoice;
  setChoice: (next: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  choice: 'system',
  setChoice: () => {},
});

function readStored(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage can throw outright in private mode; 'system' is a fine answer.
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Starts at 'system' on both server and client so the first render matches
  // the server HTML; the effect below corrects it immediately after mount.
  // The *visible* theme is already right by then — the inline script set the
  // attribute before paint. This state only drives which button looks active.
  const [choice, setChoiceState] = useState<ThemeChoice>('system');

  useEffect(() => {
    setChoiceState(readStored());
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    const root = document.documentElement;
    if (next === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);

    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The theme still applies for this session; it just will not be
      // remembered. Not worth telling the user about.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ choice, setChoice }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
