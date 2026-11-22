import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, size, space } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
function icon(on: IconName, off: IconName) {
  function TabIcon({ color: c, focused }: { color: unknown; focused: boolean }) {
    return <Ionicons name={focused ? on : off} color={c as string} size={24} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.lime,
        tabBarInactiveTintColor: color.subtle,
        tabBarStyle: {
          backgroundColor: color.bg,
          borderTopColor: color.line,
          height: 64 + insets.bottom,
          paddingTop: space.xs,
        },
        tabBarLabelStyle: { fontFamily: font.bodyBold, fontSize: size.tiny },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('barbell', 'barbell-outline') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('trending-up', 'trending-up-outline') }} />
      <Tabs.Screen name="supplements" options={{ title: 'Supps', tabBarIcon: icon('flask', 'flask-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('options', 'options-outline') }} />
    </Tabs>
  );
}
