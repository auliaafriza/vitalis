import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

/**
 * The same two palettes as the web app, expressed as hex because React Native
 * has no CSS custom properties. Keeping the two in sync by hand is a known
 * cost; the alternative (a shared token package emitting both) is the next
 * step if the design grows.
 *
 * Both palettes are annotated with the same `Theme` interface, so adding a
 * colour to one and forgetting the other is a type error rather than a screen
 * that renders `undefined` as transparent.
 */
export interface Theme {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;

  brand: string;
  brandDim: string;
  brandSoft: string;
  onBrand: string;

  food: string;
  water: string;
  sleep: string;
  move: string;
  body: string;

  danger: string;

  /** Cards lift off a light ground; on a dark one the border does that job. */
  shadowOpacity: number;
}

export const lightTheme: Theme = {
  bg: '#f4f4ee',
  surface: '#ffffff',
  surfaceAlt: '#eceee4',
  border: '#d9dccf',
  text: '#16241c',
  textMuted: '#55635a',
  textDim: '#7c8a80',

  brand: '#15653c',
  brandDim: '#b9d8c6',
  brandSoft: '#e7f1ea',
  onBrand: '#f4f4ee',

  food: '#3f9a57',
  water: '#2f86c4',
  sleep: '#6a5bd0',
  move: '#c07d12',
  body: '#c4506a',

  danger: '#c4506a',
  shadowOpacity: 0.07,
};

export const darkTheme: Theme = {
  bg: '#0d1117',
  surface: '#161b22',
  surfaceAlt: '#1f2732',
  border: '#2f3845',
  text: '#eef1f5',
  textMuted: '#c6cedb',
  // Raised from the old #5c6773, which sat at about 4:1 on the page — legible
  // for a label, not for the hint text it was actually used on.
  textDim: '#93a0ae',

  brand: '#3dd6a0',
  brandDim: '#1f7a5c',
  brandSoft: '#16302a',
  onBrand: '#0d1117',

  food: '#a8e05f',
  water: '#5cb8f0',
  sleep: '#9b8cf5',
  move: '#f0b95c',
  body: '#f07a8c',

  danger: '#f07a8c',

  shadowOpacity: 0,
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'calorya-theme';

interface ThemeContextValue {
  theme: Theme;
  /** What the user picked — 'system' stays 'system', it is not resolved away. */
  choice: ThemeChoice;
  /** What is actually on screen right now. */
  scheme: 'light' | 'dark';
  setChoice: (next: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  choice: 'system',
  scheme: 'light',
  setChoice: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');

  // AsyncStorage is async, so the very first frames use 'system'. That is the
  // right default to flash: it already matches the phone, so most users see no
  // change at all when the stored value arrives.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!alive) return;
        if (stored === 'light' || stored === 'dark') setChoiceState(stored);
      })
      .catch(() => {
        // Unreadable storage only costs the remembered preference.
      });
    return () => {
      alive = false;
    };
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    const write =
      next === 'system'
        ? AsyncStorage.removeItem(STORAGE_KEY)
        : AsyncStorage.setItem(STORAGE_KEY, next);
    write.catch(() => {
      // Applied for this session either way.
    });
  }, []);

  const scheme: 'light' | 'dark' =
    choice === 'system' ? (system === 'dark' ? 'dark' : 'light') : choice;

  const value = useMemo(
    () => ({
      theme: scheme === 'dark' ? darkTheme : lightTheme,
      choice,
      scheme,
      setChoice,
    }),
    [scheme, choice, setChoice],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

type NamedStyles = Parameters<typeof StyleSheet.create>[0];

/**
 * Build a stylesheet from the active theme, rebuilding it only when the theme
 * actually changes.
 *
 * This is what lets the screens keep their `styles.card` shape instead of
 * scattering inline colour objects through the JSX: a screen declares
 * `const makeStyles = (t: Theme) => StyleSheet.create({...})` at module level
 * and calls `useThemedStyles(makeStyles)` inside the component.
 *
 * The cache is keyed on the theme object identity, and both palettes are
 * module constants, so switching back and forth reuses the two sheets rather
 * than allocating a new one each time.
 */
export function useThemedStyles<T extends NamedStyles>(factory: (theme: Theme) => T): T {
  const { theme } = useTheme();
  const cache = useRef(new Map<Theme, T>());

  return useMemo(() => {
    const hit = cache.current.get(theme);
    if (hit) return hit;
    const built = factory(theme);
    cache.current.set(theme, built);
    return built;
  }, [theme, factory]);
}
