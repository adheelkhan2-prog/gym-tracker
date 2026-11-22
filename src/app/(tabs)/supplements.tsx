import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, Card, SectionLabel, Screen } from '../../components/ui';
import { SUPPORTED } from '../../reminders';
import { todayKey, useStore } from '../../store';
import { C, R, fmtTime, font } from '../../theme';

const SLOT_NAMES = ['Morning reminder', 'If not taken', 'Last call'];

const shift = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export default function SupplementsScreen() {
  const { state, update } = useStore();
  const key = todayKey();
  const taken = state.taken[key] ?? {};
  const allTaken = state.supplements.length > 0 && state.supplements.every((x) => taken[x]);
  const [newItem, setNewItem] = useState('');

  const toggle = (item: string) =>
    update((s) => ({ ...s, taken: { ...s.taken, [key]: { ...s.taken[key], [item]: !s.taken[key]?.[item] } } }));
  const markAll = () =>
    update((s) => ({ ...s, taken: { ...s.taken, [key]: Object.fromEntries(s.supplements.map((x) => [x, true])) } }));

  // Last 14 days of adherence.
  const now = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i);
    const k = todayKey(d);
    const t = state.taken[k] ?? {};
    return { k, d, full: state.supplements.length > 0 && state.supplements.every((x) => t[x]) };
  });
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].full) streak++;
    else if (i === days.length - 1) continue; // today not done yet doesn't break the streak
    else break;
  }

  const sendTest = async () => {
    if (!SUPPORTED) return;
    await Notifications.scheduleNotificationAsync({
      identifier: `supp-${key}-test`,
      content: {
        title: 'Morning stack 💪',
        body: `Test reminder: time for your ${state.supplements.join(' + ').toLowerCase()}.`,
        categoryIdentifier: 'supplement',
        data: { date: key, slot: -1 },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: 'supplements' },
    });
    Alert.alert('Test sent', 'Lock your phone. The reminder arrives in about 5 seconds.');
  };

  return (
    <Screen>
      <Text style={font.display}>Supplements</Text>
      <Text style={s.sub}>{allTaken ? 'All done for today. Reminders are off until tomorrow.' : 'Tap each one once you’ve had it.'}</Text>

      <View style={{ gap: 10, marginTop: 20 }}>
        {state.supplements.map((item) => {
          const on = !!taken[item];
          return (
            <Pressable
              key={item}
              onPress={() => toggle(item)}
              style={[s.item, on && s.itemOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <View style={[s.box, on && s.boxOn]}>
                {on && <Ionicons name="checkmark" size={20} color={C.accentInk} />}
              </View>
              <Text style={[s.itemText, on && { color: C.accent }]}>{item}</Text>
              <Text style={s.itemState}>{on ? 'Taken' : 'Not yet'}</Text>
            </Pressable>
          );
        })}
      </View>
      {!allTaken && state.supplements.length > 1 && (
        <View style={{ marginTop: 12 }}>
          <Button label="Mark all taken" icon="checkmark-done" onPress={markAll} />
        </View>
      )}

      <SectionLabel right={<Text style={[s.streak, font.num]}>{streak} day streak</Text>}>Last 14 days</SectionLabel>
      <View style={s.dots}>
        {days.map((d) => (
          <View key={d.k} style={s.dotCol}>
            <View style={[s.dot, d.full ? s.dotOn : d.k === key ? s.dotToday : null]} />
            <Text style={s.dotLabel}>{d.d.toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
          </View>
        ))}
      </View>

      <SectionLabel
        right={
          <Switch
            value={state.remindersOn}
            onValueChange={(v) => update((st) => ({ ...st, remindersOn: v }))}
            trackColor={{ true: C.accent, false: C.surface2 }}
            thumbColor={C.text}
            accessibilityLabel="Reminders on"
          />
        }
      >
        Reminders
      </SectionLabel>
      <Card style={{ padding: 0, opacity: state.remindersOn ? 1 : 0.45 }}>
        {state.reminderTimes.map((t, i) => (
          <View key={i} style={[s.timeRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.timeName}>{SLOT_NAMES[i] ?? `Reminder ${i + 1}`}</Text>
              <Text style={[s.time, font.num]}>{fmtTime(t)}</Text>
            </View>
            <Pressable
              style={s.step}
              onPress={() => update((st) => ({ ...st, reminderTimes: st.reminderTimes.map((x, j) => (j === i ? shift(x, -30) : x)) }))}
              accessibilityLabel={`${SLOT_NAMES[i]} 30 minutes earlier`}
            >
              <Ionicons name="remove" size={20} color={C.text} />
            </Pressable>
            <Pressable
              style={s.step}
              onPress={() => update((st) => ({ ...st, reminderTimes: st.reminderTimes.map((x, j) => (j === i ? shift(x, 30) : x)) }))}
              accessibilityLabel={`${SLOT_NAMES[i]} 30 minutes later`}
            >
              <Ionicons name="add" size={20} color={C.text} />
            </Pressable>
          </View>
        ))}
      </Card>
      <Text style={s.explain}>
        The morning reminder has <Text style={{ color: C.text }}>Taken</Text> and <Text style={{ color: C.text }}>Not yet</Text>{' '}
        buttons. Tap Not yet (or ignore it) and you’ll be reminded again at {fmtTime(state.reminderTimes[1] ?? '13:00')} and{' '}
        {fmtTime(state.reminderTimes[2] ?? '19:00')}. Once you tap Taken, the rest of today’s reminders are cancelled.
      </Text>
      {SUPPORTED ? (
        <View style={{ marginTop: 12 }}>
          <Button label="Send a test reminder" kind="ghost" icon="notifications-outline" onPress={sendTest} />
        </View>
      ) : (
        <Text style={[s.explain, { color: C.warn }]}>Reminders only work in the phone app, not in a web browser.</Text>
      )}

      <SectionLabel>Your stack</SectionLabel>
      <Card style={{ padding: 0 }}>
        {state.supplements.map((item, i) => (
          <View key={item} style={[s.timeRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
            <Text style={[s.itemText, { flex: 1, fontSize: 16 }]}>{item}</Text>
            <Pressable
              style={s.step}
              accessibilityLabel={`Remove ${item}`}
              onPress={() => update((st) => ({ ...st, supplements: st.supplements.filter((x) => x !== item) }))}
            >
              <Ionicons name="trash-outline" size={18} color={C.muted} />
            </Pressable>
          </View>
        ))}
        <View style={[s.timeRow, { borderTopWidth: state.supplements.length ? 1 : 0, borderTopColor: C.line }]}>
          <TextInput
            value={newItem}
            onChangeText={setNewItem}
            placeholder="Add a supplement (e.g. Fish oil)"
            placeholderTextColor={C.faint}
            style={s.addInput}
            onSubmitEditing={() => {
              const v = newItem.trim();
              if (v && !state.supplements.includes(v)) update((st) => ({ ...st, supplements: [...st.supplements, v] }));
              setNewItem('');
            }}
            returnKeyType="done"
          />
        </View>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  sub: { color: C.muted, fontSize: 16, marginTop: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: R.md,
    padding: 16,
    minHeight: 72,
  },
  itemOn: { backgroundColor: '#1E2611' },
  box: { width: 32, height: 32, borderRadius: 10, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.accent, borderColor: C.accent },
  itemText: { color: C.text, fontSize: 18, fontWeight: '700' },
  itemState: { marginLeft: 'auto', color: C.muted, fontWeight: '600' },
  streak: { color: C.accent, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dotCol: { alignItems: 'center', gap: 6 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.surface2 },
  dotOn: { backgroundColor: C.accent },
  dotToday: { borderWidth: 2, borderColor: C.warn, backgroundColor: 'transparent' },
  dotLabel: { color: C.faint, fontSize: 10, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, minHeight: 60 },
  timeName: { color: C.muted, fontSize: 13 },
  time: { color: C.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  step: { width: 44, height: 44, borderRadius: R.sm, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  explain: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 12 },
  addInput: { flex: 1, color: C.text, fontSize: 16, minHeight: 44 },
});
