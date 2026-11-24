import { BottomTabBarHeightCallbackContext, Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, type IconName } from '../../components/icons';
import { Press } from '../../components/ui';
import { color, font, motion, radius, size, space, touch } from '../../theme';

const TABS: Record<string, { title: string; icon: IconName }> = {
  index: { title: 'Today', icon: 'barbell' },
  progress: { title: 'Progress', icon: 'chart' },
  supplements: { title: 'Supps', icon: 'flask' },
  settings: { title: 'Settings', icon: 'sliders' },
};

/**
 * Bottom tab bar: opaque dark (scrolling content never shows through behind the labels), with a
 * fade above it; a thin crimson line springs to the active tab.
 */
function GlassTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const onHeight = useContext(BottomTabBarHeightCallbackContext);
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
    // Report the bar's real height (incl. the gesture-bar inset) so screens can pad above it.
    <View style={[s.wrap, { paddingBottom: insets.bottom + space.sm }]} pointerEvents="box-none" onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}>
      <LinearGradient colors={['rgba(7,7,8,0)', color.bg]} style={s.fade} pointerEvents="none" />
      <View style={s.bar}>
        <View style={s.row} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
          {tabW > 0 && (
            <Animated.View style={[s.pill, { width: tabW }, pill]}>
              <View style={s.pillLine} />
            </Animated.View>
          )}
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
                glow={color.accent}
              >
                <Icon name={t.icon} size={22} color={on ? color.accent : color.subtle} filled={on} />
                <Text style={[s.label, { color: on ? color.text : color.subtle }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3}>
                  {t.title}
                </Text>
              </Press>
            );
          })}
        </View>
      </View>
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
  fade: { position: 'absolute', left: 0, right: 0, top: -space.x4, height: space.x4 },
  bar: {
    padding: space.xs,
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.glassBorder,
    shadowColor: '#000000',
    shadowOpacity: 0.7,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  row: { flexDirection: 'row' },
  pill: { position: 'absolute', top: 0, bottom: 0, left: 0, alignItems: 'center' },
  pillLine: { width: 28, height: 2, borderRadius: 1, backgroundColor: color.accent, shadowColor: color.accent, shadowOpacity: 0.8, shadowRadius: 6 },
  tab: { flex: 1, minWidth: 0, minHeight: touch.primary + space.xs, alignItems: 'center', justifyContent: 'center', gap: space.xxs, paddingHorizontal: space.xxs, borderRadius: radius.lg },
  label: { fontFamily: font.bodyBold, fontSize: size.tiny, letterSpacing: 0.3 },
});

// One bad screen shows a recovery panel for that screen only; it never takes the app down.
export { RouteError as ErrorBoundary } from '../../components/RouteError';
