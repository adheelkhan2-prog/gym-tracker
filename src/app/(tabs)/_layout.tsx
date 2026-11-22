import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/tabs';
import { C } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
function icon(name: IconName) {
  function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.faint,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line },
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Train', tabBarIcon: icon('barbell') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('trending-up') }} />
      <Tabs.Screen name="supplements" options={{ title: 'Supps', tabBarIcon: icon('flask') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('options') }} />
    </Tabs>
  );
}
