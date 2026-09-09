import { Tabs } from 'expo-router';
import { TabBar } from '../../src/components/tab-bar';
import { useTheme } from '../../src/lib/theme';

/**
 * The header is hidden on every tab: each screen draws its own, because the
 * designs put controls (a date stepper, a search field) on the same line as
 * the title and a stock navigation header cannot hold those.
 */
export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Catat' }} />
      <Tabs.Screen name="trends" options={{ title: 'Progress' }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
      {/* Reached from the Beranda tiles rather than the bar — see TabBar. */}
      <Tabs.Screen name="health" options={{ title: 'Kesehatan' }} />
    </Tabs>
  );
}
