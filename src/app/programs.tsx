import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BodyModel } from '../components/body/BodyModel';
import { Backdrop, Glass } from '../components/glass';
import { Icon } from '../components/icons';
import { ORDER, SwitchSheet, programPaint } from '../components/ProgramParts';
import { Badge, Button, IconButton, Press } from '../components/ui';
import { WEEKDAY_SHORT } from '../data/program';
import { trainingDays, type Program } from '../data/programs';
import { haptic } from '../feedback';
import { allPrograms, programById, todayKey, useStore } from '../store';
import { color, font, leading, radius, size, space, themed, touch, type } from '../theme';

const GAP = space.md;

function ProgramCard({ p, live, current, pendingFrom, width, onSwitch, onEdit, onCopy }: {
  p: Program;
  live: boolean;
  current: boolean;
  pendingFrom?: string;
  width: number;
  onSwitch: () => void;
  onEdit?: () => void;
  onCopy: () => void;
}) {
  const days = trainingDays(p.week);
  return (
    <Glass strong={live} glow={live ? color.accent : undefined} r={radius.xxl} style={[s.card, { width }]}>
      <View style={s.cardTop}>
        <Badge label={`${days} day${days === 1 ? '' : 's'} / week`} />
        {current && <Badge label="Current" variant="outline" icon="check" />}
        {pendingFrom && <Badge label={`Starts ${pendingFrom}`} variant="outline" icon="calendar" />}
        {p.custom && <Badge label="Custom" variant="secondary" />}
      </View>
      <Text style={s.name} numberOfLines={2}>
        {p.name}
      </Text>
      <Text style={s.focus} numberOfLines={2}>
        {p.focus}
      </Text>
      <View style={s.model}>
        {live ? <BodyModel paint={programPaint(p)} height={220} interactive={false} showHint={false} /> : <View style={{ height: 220 }} />}
      </View>
      {p.rotation ? (
        <Text style={[type.small, { marginTop: space.md, color: color.text }]} numberOfLines={2}>
          Rotating: {p.days.map((d) => d.name).join(' → ')} → again
        </Text>
      ) : (
      <View style={s.week}>
        {ORDER.map((wd) => {
          const d = p.days.find((x) => x.id === p.week[wd]);
          return (
            <View key={wd} style={[s.wdTile, d && s.wdOn]}>
              <Text style={[s.wdDay, d && { color: color.onAccent }]}>{WEEKDAY_SHORT[wd][0]}</Text>
              <Text style={[s.wdName, d && { color: color.onAccent }]} numberOfLines={1}>
                {d ? d.name.split(/[\s&/]+/)[0] : '–'}
              </Text>
            </View>
          );
        })}
      </View>
      )}
      <Text style={[type.small, { marginTop: space.md }]} numberOfLines={3}>
        {p.blurb}
      </Text>
      <View style={s.cardBtns}>
        <View style={{ flex: 1 }}>
          {onEdit ? (
            <Button variant="secondary" icon="edit" label="Edit" onPress={onEdit} />
          ) : (
            <Button variant="secondary" icon="copy" label="Copy" accessibilityLabel={`Copy ${p.name} and edit it as your own plan`} onPress={onCopy} />
          )}
        </View>
        <View style={{ flex: 1.6 }}>
          <Button
            variant={current ? 'secondary' : 'default'}
            icon={current ? 'calendar' : 'swap'}
            label={current ? 'Change days' : 'Switch to this'}
            accessibilityLabel={current ? `Change training days for ${p.name}` : `Switch to ${p.name}`}
            onPress={onSwitch}
          />
        </View>
      </View>
    </Glass>
  );
}

export default function ProgramsScreen() {
  const { state, update } = useStore();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const cardW = width - space.lg * 2;
  const all = allPrograms(state);
  const visible = all;
  const startIdx = Math.max(0, visible.findIndex((p) => p.id === state.programId));
  const [idx, setIdx] = useState(startIdx);
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const page = cardW + GAP;
  const goTo = (i: number, animated = true) => {
    pager.current?.scrollTo({ x: i * page, y: 0, animated });
    setIdx(i);
  };
  const [switching, setSwitching] = useState<Program | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pendingFrom = state.pending ? new Date(state.pending.from.replace(/-/g, '/')).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : undefined;

  const confirm = (p: Program, week: (string | null)[], from: string) => {
    haptic.setDone();
    const today = todayKey();
    update((st) =>
      from <= today ? { ...st, programId: p.id, week, pending: null } : { ...st, pending: { programId: p.id, week, from } },
    );
    setSwitching(null);
    setToast(from <= today ? `${p.name} is on. Today’s card is ready.` : `${p.name} starts ${new Date(from.replace(/-/g, '/')).toLocaleDateString(undefined, { weekday: 'long' })}.`);
  };

  return (
    <Backdrop>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.x4 }}>
        <View style={s.header}>
          <IconButton icon="back" label="Back" onPress={() => router.back()} />
          <Text style={s.counter}>
            {String(idx + 1).padStart(2, '0')}
            <Text style={s.of}> / {String(visible.length).padStart(2, '0')}</Text>
          </Text>
        </View>
        <View style={s.pad}>
          <Text style={s.title} accessibilityRole="header">
            Programs
          </Text>
          <Text style={type.bodyMuted}>Swipe through plans. Switching keeps every log you’ve made. Built-in plans are templates: copy one to make it yours.</Text>
          <View style={{ marginTop: space.md }}>
            <Button icon="plus" label="Create plan" onPress={() => router.push('/builder')} testID="create-plan" />
          </View>
          {toast && (
            <Animated.View entering={reduce ? undefined : FadeInDown.springify()} style={s.toast}>
              <Icon name="checkCircle" size={20} color={color.accent} filled />
              <Text style={[type.small, { flex: 1, color: color.text }]}>{toast}</Text>
            </Animated.View>
          )}
        </View>

        <ScrollView
          ref={pager}
          horizontal
          decelerationRate="fast"
          snapToInterval={page}
          snapToAlignment="start"
          showsHorizontalScrollIndicator={false}
          // Open on the current program (contentOffset isn't honoured everywhere, so scroll once laid out).
          onLayout={() => startIdx > 0 && idx === startIdx && pager.current?.scrollTo({ x: startIdx * page, y: 0, animated: false })}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: GAP, marginTop: space.xl }}
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / page);
            if (i !== idx && i >= 0 && i < visible.length) setIdx(i);
          }}
          scrollEventThrottle={32}
          testID="program-pager"
        >
          {visible.map((p, i) => (
            <ProgramCard
              key={p.id}
              p={p}
              live={i === idx}
              current={p.id === state.programId}
              pendingFrom={state.pending?.programId === p.id ? pendingFrom : undefined}
              width={cardW}
              onSwitch={() => setSwitching(p)}
              onEdit={p.custom ? () => router.push({ pathname: '/builder', params: { id: p.id } }) : undefined}
              onCopy={() => router.push({ pathname: '/builder', params: { template: p.id } })}
            />
          ))}
        </ScrollView>

        <View style={s.dots}>
          {visible.map((p, i) => (
            <Press
              key={p.id}
              onPress={() => goTo(i)}
              tick={false}
              style={s.dotHit}
              accessibilityRole="button"
              accessibilityLabel={`Show ${p.name}`}
              accessibilityState={{ selected: i === idx }}
            >
              <View style={[s.dot, i === idx && s.dotOn]} />
            </Press>
          ))}
        </View>

        <View style={[s.pad, { gap: space.md, marginTop: space.xl }]}>
          {state.pending && (
            <Glass r={radius.xl} style={s.note}>
              <Icon name="calendar" size={22} color={color.accent} />
              <Text style={[type.small, { flex: 1, color: color.text }]}>
                {programById(state, state.pending.programId)?.name} starts {pendingFrom}.
              </Text>
              <Button size="sm" variant="ghost" label="Cancel" onPress={() => update((st) => ({ ...st, pending: null }))} />
            </Glass>
          )}
          <Button variant="outline" icon="plus" label="Create a plan from scratch" onPress={() => router.push('/builder')} />
          <Text style={[type.small, { textAlign: 'center' }]}>Templates and their sources are listed in the app’s exercise-sources file.</Text>
        </View>
      </ScrollView>
      {switching && (
        <SwitchSheet
          program={switching}
          currentWeek={switching.id === state.programId ? state.week : undefined}
          onClose={() => setSwitching(null)} onConfirm={(week, from) => confirm(switching, week, from)} />
      )}
    </Backdrop>
  );
}

const s = themed(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  counter: { fontFamily: font.display, fontSize: size.h2, color: color.accent, fontVariant: ['tabular-nums'], paddingRight: space.md },
  of: { fontFamily: font.bodyBold, fontSize: size.small, color: color.subtle },
  pad: { paddingHorizontal: space.lg },
  title: { fontFamily: font.display, fontSize: size.numXL, lineHeight: leading.numXL, letterSpacing: -2, color: color.text, marginTop: space.md },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: color.accentDim, borderWidth: 1, borderColor: color.accentGlow },
  card: { padding: space.xl },
  cardTop: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  name: { fontFamily: font.display, fontSize: size.title, lineHeight: 32, letterSpacing: -0.8, color: color.text, marginTop: space.md },
  focus: { ...type.bodyMuted, marginTop: space.xs },
  model: { marginHorizontal: -space.md, marginTop: space.sm },
  week: { flexDirection: 'row', gap: 4, marginTop: space.sm },
  wdTile: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm, backgroundColor: color.surface2, gap: 2 },
  wdOn: { backgroundColor: color.accent },
  wdDay: { fontFamily: font.bodyBlack, fontSize: size.tiny, color: color.muted },
  wdName: { fontFamily: font.bodyBold, fontSize: 9, color: color.subtle },
  cardBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: space.sm },
  dotHit: { minWidth: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.glassBorder },
  dotOn: { width: 20, backgroundColor: color.accent },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
}));

// One bad screen shows a recovery panel for that screen only; it never takes the app down.
export { RouteError as ErrorBoundary } from '../components/RouteError';
