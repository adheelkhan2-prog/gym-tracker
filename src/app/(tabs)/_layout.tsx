import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '../../components/glass';
import { Icon, type IconName } from '../../components/icons';
import { Press } from '../../components/ui';
import { color, font, motion, radius, size, space, touch } from '../../theme';

const TABS: Record<string, { title: string; icon: IconName }> = {
  index: { title: 'Today', icon: 'barbell' },
  progress: { title: 'Progress', icon: 'chart' },
  supplements: { title: 'Supps', icon: 'flask' },
  settings: { title: 'Settings', icon: 'sliders' },
};

/** Floating glass tab bar; a lime pill springs to the active tab. */
function GlassTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const tabW = w / state.routes.length;
  useEffect(() => {
    const to = state.index * tabW;
    x.set(reduce || !tabW ? to : withSpring(to, motion.spring));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, tabW, reduce]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + space.sm }]} pointerEvents="box-none">
      <Glass style={s.bar} r={radius.pill}>
        <View style={s.row} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
          {tabW > 0 && <Animated.View style={[s.pill, { width: tabW }, pill]} />}
          {state.routes.map((route, i) => {
            const t = TABS[route.name] ?? { title: route.name, icon: 'barbell' as IconName };
            const on = state.index === i;
            return (
              <Press
                key={route.key}
                onPress={() => {
                  if (!on) navigateToTab(route.key);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t.title}
                style={s.tab}
                glow={color.lime}
              >
                <Icon name={t.icon} size={22} color={on ? color.ink : color.muted} filled={on} />
                <Text style={[s.label, { color: on ? color.ink : color.muted }]}>{t.title}</Text>
              </Press>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="supplements" options={{ title: 'Supps' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg },
  bar: { padding: space.xs },
  row: { flexDirection: 'row' },
  pill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: radius.pill, backgroundColor: color.lime },
  tab: { flex: 1, minHeight: touch.primary + space.xs, alignItems: 'center', justifyContent: 'center', gap: space.xxs, borderRadius: radius.pill },
  label: { fontFamily: font.bodyBlack, fontSize: size.tiny },
});
