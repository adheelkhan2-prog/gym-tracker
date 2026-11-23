import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Glass } from '../../components/glass';
import { Icon } from '../../components/icons';
import { Burst, CountUp } from '../../components/motion';
import { Button, IconButton, Press, Screen, SectionTitle, Switch } from '../../components/ui';
import { SUPPS, line } from '../../copy';
import { haptic } from '../../feedback';
import { SUPPORTED } from '../../reminders';
import { addDays, allTaken, dateFromKey, supplementStreak, todayKey, useStore } from '../../store';
import { color, fmtTime, font, leading, motion, radius, size, space, touch, type } from '../../theme';

const SLOT_NAMES = ['Morning reminder', 'If not taken', 'Last call'];

const shift = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

function SuppItem({ name, on, onPress, index, boxRef }: { name: string; on: boolean; onPress: () => void; index: number; boxRef: (v: React.ComponentRef<typeof View> | null) => void }) {
  const reduce = useReducedMotion();
  const sc = useSharedValue(1);
  const was = useRef(on);
  useEffect(() => {
    if (on && !was.current && !reduce) sc.set(withSequence(withTiming(0.55, { duration: 60 }), withSpring(1, motion.pop)));
    was.current = on;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.delay(index * motion.stagger).springify().damping(16)}>
      <Press onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={name} style={{ borderRadius: radius.xxl }} tick={false}>
        <Glass r={radius.xxl} style={[s.item, on && s.itemOn]}>
          <Animated.View ref={boxRef} collapsable={false} style={[s.box, on && s.boxOn, st]}>{on && <Icon name="check" size={28} color={color.ink} />}</Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={[s.itemText, on && { color: color.lime }]}>{name}</Text>
            <Text style={type.small}>{on ? 'Taken today' : 'Tap when you’ve had it'}</Text>
          </View>
          <Icon name="flask" size={28} color={on ? color.lime : color.subtle} filled={on} />
        </Glass>
      </Press>
    </Animated.View>
  );
}

export default function SupplementsScreen() {
  const { state, update } = useStore();
  const key = todayKey();
  const taken = state.taken[key] ?? {};
  const done = allTaken(state, key);
  const streak = supplementStreak(state);
  const [newItem, setNewItem] = useState('');
  const [burst, setBurst] = useState(0);
  const [testSent, setTestSent] = useState(false);

  const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const boxRefs = useRef<Record<string, React.ComponentRef<typeof View> | null>>({});
  const [burstAt, setBurstAt] = useState({ x: 0, y: 0 });
  const setTaken = (next: Record<string, boolean>, from?: string) => {
    const willBeDone = state.supplements.length > 0 && state.supplements.every((x) => next[x]);
    if (willBeDone && !done) {
      haptic.pr();
      const node = boxRefs.current[from ?? state.supplements[state.supplements.length - 1]];
      const root = rootRef.current;
      if (node && root)
        root.measureInWindow((rx: number, ry: number) =>
          node.measureInWindow((x: number, y: number, w: number, h: number) => {
            setBurstAt({ x: x - rx + w / 2, y: y - ry + h / 2 });
            setBurst((b) => b + 1);
          }),
        );
    } else haptic.setDone();
    update((st) => ({ ...st, taken: { ...st.taken, [key]: next } }));
  };

  const days = Array.from({ length: 14 }, (_, i) => {
    const k = addDays(key, i - 13);
    return { k, d: dateFromKey(k), full: allTaken(state, k) };
  });

  const sendTest = async () => {
    if (!SUPPORTED) return;
    await Notifications.scheduleNotificationAsync({
      identifier: `supp-${key}-test`,
      content: {
        title: 'Morning stack',
        body: `Test reminder: time for your ${state.supplements.join(' + ').toLowerCase()}.`,
        categoryIdentifier: 'supplement',
        data: { date: key, slot: -1 },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: 'supplements' },
    });
    setTestSent(true);
  };

  return (
    <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
      <Screen padBottom={140}>
        {/* Hero: the streak, huge, in pink */}
        <View style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>Supplement streak</Text>
            <View style={s.megaRow}>
              <CountUp to={streak} style={s.mega} />
              <Icon name="flame" size={56} color={streak > 0 ? color.lime : color.subtle} filled={streak > 0} />
            </View>
            <Text style={s.sub}>{done ? 'All done today. Reminders are off until tomorrow.' : line(SUPPS, key)}</Text>
          </View>
        </View>

        <View style={{ gap: space.sm, marginTop: space.xl }}>
          {state.supplements.map((item, i) => (
            <SuppItem
              key={item}
              index={i}
              name={item}
              on={!!taken[item]}
              onPress={() => setTaken({ ...taken, [item]: !taken[item] }, item)}
              boxRef={(v) => {
                boxRefs.current[item] = v;
              }}
            />
          ))}
          {state.supplements.length === 0 && (
            <Glass r={radius.xl} style={{ alignItems: 'center', gap: space.sm, padding: space.xl }}>
              <Icon name="flask" size={32} color={color.subtle} />
              <Text style={[type.bodyMuted, { textAlign: 'center' }]}>Your stack is empty. Add a supplement below.</Text>
            </Glass>
          )}
        </View>
        {!done && state.supplements.length > 1 && (
          <View style={{ marginTop: space.md }}>
            <Button icon="check" label="Mark all taken" onPress={() => setTaken(Object.fromEntries(state.supplements.map((x) => [x, true])))} />
          </View>
        )}

        <SectionTitle>Last 14 days</SectionTitle>
        <View style={s.dots}>
          {days.map((d) => (
            <View key={d.k} style={s.dotCol}>
              <View style={[s.dot, d.full ? s.dotOn : d.k === key ? s.dotToday : null]}>
                {d.full && <Icon name="check" size={12} color={color.ink} />}
              </View>
              <Text style={s.dotLabel}>{d.d.toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
            </View>
          ))}
        </View>

        <SectionTitle right={<Switch checked={state.remindersOn} onCheckedChange={(v) => update((st) => ({ ...st, remindersOn: v }))} label="Reminders on" />}>
          Reminders
        </SectionTitle>
        <Glass r={radius.xxl} style={{ opacity: state.remindersOn ? 1 : 0.5 }}>
          {state.reminderTimes.map((t, i) => (
            <View key={i} style={[s.timeRow, i > 0 && s.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={type.small}>{SLOT_NAMES[i] ?? `Reminder ${i + 1}`}</Text>
                <Text style={[type.num, { fontSize: size.h2 }]}>{fmtTime(t)}</Text>
              </View>
              <IconButton
                icon="minus"
                label={`${SLOT_NAMES[i]} 30 minutes earlier`}
                onPress={() => update((st) => ({ ...st, reminderTimes: st.reminderTimes.map((x, j) => (j === i ? shift(x, -30) : x)) }))}
              />
              <IconButton
                icon="plus"
                label={`${SLOT_NAMES[i]} 30 minutes later`}
                onPress={() => update((st) => ({ ...st, reminderTimes: st.reminderTimes.map((x, j) => (j === i ? shift(x, 30) : x)) }))}
              />
            </View>
          ))}
        </Glass>
        <Text style={[type.small, { marginTop: space.md }]}>
          The morning reminder has <Text style={s.strong}>Taken</Text> and <Text style={s.strong}>Not yet</Text> buttons. Tap Not yet (or ignore it)
          and you’ll be reminded again at {fmtTime(state.reminderTimes[1] ?? '13:00')} and {fmtTime(state.reminderTimes[2] ?? '19:00')}. Tap Taken
          and the rest of today’s reminders are cancelled.
        </Text>
        {SUPPORTED ? (
          <View style={{ marginTop: space.md }}>
            <Button variant="secondary" icon={testSent ? 'check' : 'bell'} label={testSent ? 'Test sent: lock your phone' : 'Send a test reminder'} onPress={sendTest} />
          </View>
        ) : (
          <Text style={[type.small, { color: color.muted, marginTop: space.md }]}>Reminders only work in the Android app, not in a web browser.</Text>
        )}

        <SectionTitle>Your stack</SectionTitle>
        <Glass r={radius.xxl}>
          {state.supplements.map((item, i) => (
            <View key={item} style={[s.timeRow, i > 0 && s.divider]}>
              <Text style={[type.h3, { flex: 1 }]}>{item}</Text>
              <IconButton icon="trash" label={`Remove ${item}`} onPress={() => update((st) => ({ ...st, supplements: st.supplements.filter((x) => x !== item) }))} />
            </View>
          ))}
          <View style={[s.timeRow, state.supplements.length > 0 && s.divider]}>
            <TextInput
              value={newItem}
              onChangeText={setNewItem}
              placeholder="Add a supplement (e.g. Fish oil)"
              placeholderTextColor={color.subtle}
              style={s.addInput}
              onSubmitEditing={() => {
                const v = newItem.trim();
                if (v && !state.supplements.includes(v)) update((st) => ({ ...st, supplements: [...st.supplements, v] }));
                setNewItem('');
              }}
              returnKeyType="done"
              accessibilityLabel="New supplement name"
            />
          </View>
        </Glass>
      </Screen>
      <Burst burst={burst} x={burstAt.x} y={burstAt.y} colors={[color.lime, color.limeSoft, color.text]} />
    </View>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'flex-end' },
  kicker: { ...type.label },
  megaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mega: { fontFamily: font.display, fontSize: size.giga, lineHeight: leading.giga, letterSpacing: -4, color: color.text, fontVariant: ['tabular-nums'] },
  sub: { fontFamily: font.display, fontSize: size.h3, lineHeight: 24, color: color.muted },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.xl, minHeight: 92 },
  itemOn: { borderColor: color.lime },
  box: { width: 48, height: 48, borderRadius: radius.sm, borderWidth: 3, borderColor: color.subtle, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: color.lime, borderColor: color.lime },
  itemText: { fontFamily: font.display, fontSize: size.h2, color: color.text },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dotCol: { alignItems: 'center', gap: space.xs },
  dot: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: color.glassBorder, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: color.lime },
  dotToday: { borderWidth: 1, borderColor: color.limeEdge, backgroundColor: color.bg },
  dotLabel: { fontFamily: font.bodyBold, fontSize: size.tiny, color: color.subtle },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: 72 },
  divider: { borderTopWidth: 1, borderTopColor: color.line },
  strong: { fontFamily: font.bodyBold, color: color.text },
  addInput: { flex: 1, fontFamily: font.body, color: color.text, fontSize: size.body, minHeight: touch.min },
});
