import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, SlideInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';
import { color, font, leading, motion, radius, size, space, type } from '../theme';
import { Blob, Glass } from './glass';
import { Button, Press } from './ui';
import { LinearGradient } from 'expo-linear-gradient';

export type ShareData = {
  title: string;
  date: string;
  volume: string;
  unit: string;
  sets: number;
  minutes: number | null;
  prs: { name: string; value: string }[];
  rank: string;
  level: number;
  bodyImage: string | null;
};

/** The image that gets shared: a 9:16 story card. */
function StoryCard({ d, width }: { d: ShareData; width: number }) {
  const h = (width * 16) / 9;
  return (
    <View style={[s.card, { width, height: h }]}>
      <LinearGradient colors={['#151515', '#0A0A0A']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', left: -width * 0.45, top: -width * 0.4 }}>
        <Blob size={width * 1.3} tint={color.accent} opacity={0.3} />
      </View>
      <View style={{ position: 'absolute', right: -width * 0.4, top: h * 0.4 }}>
        <Blob size={width * 1.1} tint={color.glowDeep} opacity={0.5} />
      </View>
      <Text style={s.cardDate}>{d.date}</Text>
      <Text style={s.cardTitle}>{d.title}</Text>
      {d.bodyImage ? (
        <Image source={{ uri: d.bodyImage }} style={{ width: width * 0.9, height: h * 0.4, alignSelf: 'center' }} resizeMode="contain" />
      ) : (
        <View style={{ height: h * 0.4 }} />
      )}
      <Text style={s.cardBig} numberOfLines={1} adjustsFontSizeToFit>
        {d.volume}
        <Text style={s.cardUnit}> {d.unit}</Text>
      </Text>
      <Text style={s.cardLabel}>total volume</Text>
      <View style={s.cardRow}>
        <Text style={s.cardStat}>
          {d.sets}
          <Text style={s.cardStatLabel}> sets</Text>
        </Text>
        {d.minutes ? (
          <Text style={s.cardStat}>
            {d.minutes}
            <Text style={s.cardStatLabel}> min</Text>
          </Text>
        ) : null}
        <Text style={s.cardStat}>
          {d.prs.length}
          <Text style={s.cardStatLabel}> PR{d.prs.length === 1 ? '' : 's'}</Text>
        </Text>
      </View>
      {d.prs.slice(0, 3).map((p) => (
        <Text key={p.name} style={s.cardPr} numberOfLines={1}>
          ★ {p.name} · {p.value}
        </Text>
      ))}
      <View style={s.cardFoot}>
        <Text style={s.cardRank}>
          {d.rank} · Level {d.level}
        </Text>
        <Text style={s.cardBrand}>GYM TRACKER</Text>
      </View>
    </View>
  );
}

/** Bottom sheet with a story-card preview. Drag down to dismiss. */
export function ShareSheet({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardRef = useRef<React.ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const y = useSharedValue(0);
  const cardW = Math.min(width - space.x5 * 2, (height * 0.55 * 9) / 16);

  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: (e) => {
      'worklet';
      y.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 140 || e.velocityY > 900) {
        y.set(withSpring(height, { ...motion.swipe, velocity: e.velocityY }));
        scheduleOnRN(onClose);
      } else y.set(withSpring(0, motion.spring));
    },
  });
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const share = async () => {
    if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
      setMsg('Sharing opens WhatsApp, Instagram and more in the Android app.');
      return;
    }
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your session' });
    } catch {
      setMsg('Couldn’t create the image. Try again.');
    }
    setBusy(false);
  };

  return (
    <Animated.View entering={FadeIn.duration(motion.fast)} style={s.scrim}>
      <Press onPress={onClose} tick={false} scaleTo={1} glow={color.bg} style={[StyleSheet.absoluteFill, { borderRadius: 0 }]} accessibilityLabel="Close share sheet">
        <View />
      </Press>
      <GestureDetector gesture={pan}>
        <Animated.View entering={SlideInDown.springify().damping(18)} style={[s.sheetWrap, sheet]}>
          <Glass strong r={radius.xxl} style={[s.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <View style={s.grabber} />
            <Text style={[type.h2, { textAlign: 'center' }]}>Share your session</Text>
            <View ref={cardRef} collapsable={false} style={{ alignSelf: 'center', marginTop: space.lg, borderRadius: radius.lg, overflow: 'hidden' }}>
              <StoryCard d={data} width={cardW} />
            </View>
            {msg && <Text style={[type.small, { textAlign: 'center', marginTop: space.md }]}>{msg}</Text>}
            <View style={{ marginTop: space.lg, gap: space.sm }}>
              <Button size="lg" icon="share" label="Share image" loading={busy} onPress={share} />
              <Button variant="ghost" label="Close" onPress={onClose} />
            </View>
          </Glass>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim, justifyContent: 'flex-end' },
  sheetWrap: { paddingHorizontal: space.sm },
  sheet: { padding: space.lg, paddingTop: space.md },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: radius.pill, backgroundColor: color.glassBorder, marginBottom: space.md },
  card: { padding: space.xl, justifyContent: 'flex-start' },
  cardDate: { ...type.label, color: color.accentText },
  cardTitle: { fontFamily: font.display, fontSize: size.title, lineHeight: leading.title, color: color.text, letterSpacing: -0.8 },
  cardBig: { fontFamily: font.display, fontSize: size.numXL, lineHeight: leading.numXL, color: color.accent, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  cardUnit: { fontFamily: font.bodyBold, fontSize: size.h3, color: color.muted },
  cardLabel: { ...type.label, marginTop: -space.xs },
  cardRow: { flexDirection: 'row', gap: space.lg, marginTop: space.md },
  cardStat: { fontFamily: font.display, fontSize: size.h2, color: color.text },
  cardStatLabel: { fontFamily: font.bodyBold, fontSize: size.small, color: color.muted },
  cardPr: { fontFamily: font.bodyBold, fontSize: size.small, color: color.accentText, marginTop: space.xs },
  cardFoot: { position: 'absolute', left: space.xl, right: space.xl, bottom: space.lg, flexDirection: 'row', justifyContent: 'space-between' },
  cardRank: { fontFamily: font.bodyBlack, fontSize: size.label, color: color.accentText },
  cardBrand: { fontFamily: font.display, fontSize: size.label, letterSpacing: 2, color: color.text },
});


