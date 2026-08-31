import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { theme } from '../../src/lib/theme';

/**
 * Emoji tab icons keep the app dependency-free at this stage. Swapping in an
 * icon set later is a change to this file only.
 */
function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.bg,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textDim,
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color }) => <TabIcon glyph="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrisi',
          tabBarIcon: ({ color }) => <TabIcon glyph="🍽" color={color} />,
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: 'Kesehatan',
          tabBarIcon: ({ color }) => <TabIcon glyph="♡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: 'Tren',
          tabBarIcon: ({ color }) => <TabIcon glyph="📈" color={color} />,
        }}
      />
    </Tabs>
  );
}
