import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Glass } from '../../components/glass';
import { Icon } from '../../components/icons';
import { Burst, CountUp } from '../../components/motion';
import { TimeField } from '../../components/TimeField';
import { Button, IconButton, Press, Screen, SectionTitle, Switch } from '../../components/ui';
import { SUPPS, line } from '../../copy';
import { haptic } from '../../feedback';
import { SUPPORTED, sendTestReminder } from '../../reminders';
import {
  addDays,
  addSupplement,
  allTaken,
  dateFromKey,
  reminderFor,
  removeSupplement,
  renameSupplement,
  supplementStreak,
  supplementStreakFor,
  todayKey,
  useStore,
  type State,
  type SuppReminder,
} from '../../store';
import { bottomClearance, color, fmtTime, font, leading, motion, radius, size, space, themed, touch, type } from '../../theme';

/** Two hours after a time (for a new follow-up), capped at 22:00. */
const later = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${String(Math.min(22, h + 2)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
          <Animated.View ref={boxRef} collapsable={false} style={[s.box, on && s.boxOn, st]}>{on && <Icon name="check" size={28} color={color.onAccent} />}</Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={[s.itemText, on && { color: color.accentText }]}>{name}</Text>
            <Text style={type.small}>{on ? 'Taken today' : 'Tap when you’ve had it'}</Text>
          </View>
          <Icon name="flask" size={28} color={on ? color.accent : color.subtle} filled={on} />
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
  const [open, setOpen] = useState<string | null>(null);

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

  return (
    <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
      <Screen padBottom={bottomClearance.tabs}>
        {/* Hero: the streak, huge */}
        <View style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>Supplement streak</Text>
            <View style={s.megaRow}>
              <CountUp to={streak} style={s.mega} />
              <Icon name="flame" size={56} color={streak > 0 ? color.accent : color.subtle} filled={streak > 0} />
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
                {d.full && <Icon name="check" size={12} color={color.onAccent} />}
              </View>
              <Text style={s.dotLabel}>{d.d.toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
            </View>
          ))}
        </View>

        <SectionTitle>Your stack</SectionTitle>
        <Text style={[type.small, { marginBottom: space.md }]}>Tap a supplement to set its own reminders.</Text>
        <View style={{ gap: space.sm }}>
          {state.supplements.map((item) => (
            <StackItem
              key={item}
              name={item}
              state={state}
              open={open === item}
              onToggle={() => setOpen((o) => (o === item ? null : item))}
              onReminder={(r) => update((st) => ({ ...st, suppReminders: { ...st.suppReminders, [item]: r } }))}
              onRename={(to) => {
                update((st) => renameSupplement(st, item, to));
                setOpen(to.trim() || item);
              }}
              onDelete={() => {
                update((st) => removeSupplement(st, item));
                setOpen(null);
              }}
              today={key}
            />
          ))}
          <Glass r={radius.xl} style={s.addRow}>
            <Icon name="plus" size={18} color={color.muted} />
            <TextInput
              value={newItem}
              onChangeText={setNewItem}
              placeholder="Add a supplement (e.g. Fish oil)"
              placeholderTextColor={color.subtle}
              style={s.addInput}
              onSubmitEditing={() => {
                const v = newItem.trim();
                if (v && !state.supplements.includes(v)) {
                  update((st) => addSupplement(st, v));
                  setOpen(v);
                }
                setNewItem('');
              }}
              returnKeyType="done"
              accessibilityLabel="New supplement name"
            />
          </Glass>
        </View>
        {!SUPPORTED && <Text style={[type.small, { color: color.muted, marginTop: space.md }]}>Reminders only work in the Android app, not in a web browser.</Text>}
      </Screen>
      <Burst burst={burst} x={burstAt.x} y={burstAt.y} colors={[color.accent, color.accentPressed, color.text]} />
    </View>
  );
}

/** One supplement in "Your stack": tap to expand its own reminders, streak, test, rename, delete. */
function StackItem({
  name,
  state,
  open,
  onToggle,
  onReminder,
  onRename,
  onDelete,
  today,
}: {
  name: string;
  state: State;
  open: boolean;
  onToggle: () => void;
  onReminder: (r: SuppReminder) => void;
  onRename: (to: string) => void;
  onDelete: () => void;
  today: string;
}) {
  const r = reminderFor(state, name);
  const streak = supplementStreakFor(state, name, today);
  const [sent, setSent] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<SuppReminder>) => onReminder({ ...r, ...patch });
  const summary = r.on ? `${fmtTime(r.morning)}${r.followUps.length ? ` + ${r.followUps.length} follow-up${r.followUps.length > 1 ? 's' : ''}` : ''}${r.lastCall ? ' + last call' : ''}` : 'Reminders off';
  return (
    <Glass r={radius.xl} style={[s.stack, open && s.stackOpen]}>
      <Press onPress={onToggle} style={s.stackHead} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${name} reminders, ${summary}, ${streak} day streak`} testID={`supp-${name}`}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.h3} numberOfLines={1}>
            {name}
          </Text>
          <Text style={type.small} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <View style={s.streak}>
          <Icon name="flame" size={16} color={streak > 0 ? color.accent : color.subtle} filled={streak > 0} />
          <Text style={[s.streakText, streak > 0 && { color: color.accentText }]}>{streak}</Text>
        </View>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} color={color.muted} />
      </Press>
      {open && (
        <View style={s.stackBody}>
          <View style={s.line}>
            <Text style={[type.body, { flex: 1 }]}>Reminders</Text>
            <Switch checked={r.on} onCheckedChange={(v) => set({ on: v })} label={`${name} reminders`} />
          </View>
          <View style={{ opacity: r.on ? 1 : 0.45, gap: space.xs }} pointerEvents={r.on ? 'auto' : 'none'}>
            <TimeField label="Morning" value={r.morning} onChange={(t) => set({ morning: t })} testID={`supp-${name}-morning`} />
            {r.followUps.map((t, i) => (
              <View key={i} style={s.line}>
                <View style={{ flex: 1 }}>
                  <TimeField label={`If not taken${r.followUps.length > 1 ? ` (${i + 1})` : ''}`} value={t} onChange={(v) => set({ followUps: r.followUps.map((x, j) => (j === i ? v : x)).sort() })} />
                </View>
                <IconButton icon="close" label={`Remove follow-up at ${fmtTime(t)}`} onPress={() => set({ followUps: r.followUps.filter((_, j) => j !== i) })} />
              </View>
            ))}
            {r.followUps.length < 4 && (
              <Press onPress={() => set({ followUps: [...r.followUps, later(r.followUps[r.followUps.length - 1] ?? r.morning)].sort() })} style={s.small} accessibilityRole="button" accessibilityLabel={`Add a follow-up reminder for ${name}`}>
                <Icon name="plus" size={14} color={color.muted} />
                <Text style={s.smallText}>Add a follow-up</Text>
              </Press>
            )}
            {r.lastCall ? (
              <View style={s.line}>
                <View style={{ flex: 1 }}>
                  <TimeField label="Last call" value={r.lastCall} onChange={(t) => set({ lastCall: t })} />
                </View>
                <IconButton icon="close" label="Turn off the last call" onPress={() => set({ lastCall: null })} />
              </View>
            ) : (
              <Press onPress={() => set({ lastCall: '20:00' })} style={s.small} accessibilityRole="button" accessibilityLabel={`Add a last call for ${name}`}>
                <Icon name="plus" size={14} color={color.muted} />
                <Text style={s.smallText}>Add a last call</Text>
              </Press>
            )}
          </View>
          <Text style={type.small}>
            Each reminder has <Text style={s.strong}>Taken</Text> and <Text style={s.strong}>Not yet</Text> buttons. Taken stops the rest of today’s {name.toLowerCase()} reminders only.
          </Text>
          {SUPPORTED && (
            <Button
              variant="secondary"
              icon={sent ? 'check' : 'bell'}
              label={sent ? 'Test sent: lock your phone' : 'Send a test reminder'}
              onPress={async () => {
                await sendTestReminder(name, today);
                setSent(true);
              }}
            />
          )}
          {renaming !== null ? (
            <View style={s.line}>
              <TextInput
                autoFocus
                value={renaming}
                onChangeText={setRenaming}
                onSubmitEditing={() => {
                  onRename(renaming);
                  setRenaming(null);
                }}
                style={[s.addInput, s.renameInput]}
                accessibilityLabel={`New name for ${name}`}
                returnKeyType="done"
              />
              <Button
                size="sm"
                label="Save"
                onPress={() => {
                  onRename(renaming);
                  setRenaming(null);
                }}
              />
            </View>
          ) : confirmDelete ? (
            <View style={s.line}>
              <Text style={[type.small, { flex: 1 }]}>Delete {name}? Days you took it stay in the log.</Text>
              <Button size="sm" variant="ghost" label="Keep" onPress={() => setConfirmDelete(false)} />
              <Button size="sm" variant="destructive" label="Delete" onPress={onDelete} />
            </View>
          ) : (
            <View style={s.line}>
              <Button size="sm" variant="outline" icon="edit" label="Rename" onPress={() => setRenaming(name)} />
              <Button size="sm" variant="ghost" icon="trash" label="Delete" onPress={() => setConfirmDelete(true)} />
            </View>
          )}
        </View>
      )}
    </Glass>
  );
}

const s = themed(() => StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'flex-end' },
  kicker: { ...type.label },
  megaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mega: { fontFamily: font.display, fontSize: size.giga, lineHeight: leading.giga, letterSpacing: -4, color: color.text, fontVariant: ['tabular-nums'] },
  sub: { fontFamily: font.display, fontSize: size.h3, lineHeight: 24, color: color.muted },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.xl, minHeight: 92 },
  itemOn: { borderColor: color.accent },
  box: { width: 48, height: 48, borderRadius: radius.sm, borderWidth: 3, borderColor: color.subtle, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: color.accent, borderColor: color.accent },
  itemText: { fontFamily: font.display, fontSize: size.h2, color: color.text },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dotCol: { alignItems: 'center', gap: space.xs },
  dot: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: color.glassBorder, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: color.accent },
  dotToday: { borderWidth: 1, borderColor: color.accentEdge, backgroundColor: color.bg },
  dotLabel: { fontFamily: font.bodyBold, fontSize: size.tiny, color: color.subtle },
  strong: { fontFamily: font.bodyBold, color: color.text },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  addInput: { flex: 1, fontFamily: font.body, color: color.text, fontSize: size.body, minHeight: touch.min },
  renameInput: { paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: color.surface2 },
  stack: { overflow: 'hidden' },
  stackOpen: { borderColor: color.accentEdge },
  stackHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 72 },
  stackBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md, borderTopWidth: 1, borderTopColor: color.line, paddingTop: space.md },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontFamily: font.bodyBold, fontSize: size.small, color: color.subtle, fontVariant: ['tabular-nums'] },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  small: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: touch.min, paddingHorizontal: space.xs },
  smallText: { fontFamily: font.bodySemi, fontSize: size.small, color: color.muted },
}));

// One bad screen shows a recovery panel for that screen only; it never takes the app down.
export { RouteError as ErrorBoundary } from '../../components/RouteError';
