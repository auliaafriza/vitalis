import { useRouter } from 'expo-router';
// expo-router 57 ships its own copy of the bottom-tabs types; `expo-router/tabs`
// is the public entry point for them, so nothing here reaches into build/.
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ChartIcon,
  HeartIcon,
  HomeIcon,
  LogIcon,
  PlusIcon,
  type IconProps,
} from './icons';
import { radius, spacing, useTheme, useThemedStyles, type Theme } from '../lib/theme';

/**
 * The bottom bar, with the raised action button in the middle.
 *
 * expo-router's default tab bar cannot lift a button above its own bounds, so
 * this replaces it wholesale. The button is not a tab — it is a shortcut to
 * the thing people open the app to do, which is why it has no label and no
 * selected state.
 */

const TABS: Record<string, { label: string; Icon: (p: IconProps) => React.JSX.Element }> = {
  index: { label: 'Beranda', Icon: HomeIcon },
  nutrition: { label: 'Catat', Icon: LogIcon },
  trends: { label: 'Progress', Icon: ChartIcon },
  health: { label: 'Kesehatan', Icon: HeartIcon },
};

/** Two tabs, the action button, then two more. */
const ORDER = ['index', 'nutrition', '__action__', 'trends', 'health'] as const;

export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  return (
    <View
      style={[
        styles.bar,
        // The home indicator sits under the bar on gesture-navigation phones.
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
    >
      {ORDER.map((name) => {
        if (name === '__action__') {
          return (
            <View key="action" style={styles.actionSlot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Catat makanan"
                onPress={() => router.push('/nutrition?add=1')}
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              >
                <PlusIcon color={theme.onBrand} size={26} weight={2.4} />
              </Pressable>
            </View>
          );
        }

        const tab = TABS[name];
        if (!tab) return null;

        const routeIndex = state.routes.findIndex((route) => route.name === name);
        if (routeIndex === -1) return null;

        const focused = state.index === routeIndex;
        const route = state.routes[routeIndex]!;
        const color = focused ? theme.brand : theme.textDim;

        return (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            style={styles.tab}
          >
            <tab.Icon color={color} size={22} weight={focused ? 2.2 : 1.8} />
            <Text style={[styles.label, { color }, focused && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    tab: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 2 },
    label: { fontSize: 10, fontWeight: '600' },
    labelActive: { fontWeight: '700' },
    actionSlot: { flex: 1, alignItems: 'center' },
    action: {
      // Pulled up out of the bar; the negative margin keeps the row height
      // unchanged so the four labels stay on one baseline.
      marginTop: -26,
      width: 54,
      height: 54,
      borderRadius: radius.pill,
      backgroundColor: theme.brand,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: theme.surface,
      shadowColor: '#16241c',
      shadowOpacity: theme.shadowOpacity * 2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    actionPressed: { opacity: 0.85 },
  });
