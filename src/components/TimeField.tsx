// A time you tap to change: the phone's own time picker on Android (a clock dial), a typed HH:MM
// field in the web preview. Times are stored as 'HH:MM' (24 h).
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { color, fmtTime, font, radius, size, space, themed, touch, type } from '../theme';
import { Icon } from './icons';
import { Press } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');

/** 'HH:MM' -> a Date today at that time (what the picker starts on). */
const asDate = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

export function TimeField({ label, value, onChange, testID }: { label: string; value: string; onChange: (hhmm: string) => void; testID?: string }) {
  const [typed, setTyped] = useState<string | null>(null);
  if (Platform.OS === 'web') {
    return (
      <View style={s.row}>
        <Text style={[type.small, { flex: 1 }]}>{label}</Text>
        <TextInput
          value={typed ?? value}
          onChangeText={setTyped}
          onBlur={() => {
            if (typed && /^([01]\d|2[0-3]):[0-5]\d$/.test(typed)) onChange(typed);
            setTyped(null);
          }}
          style={s.webInput}
          accessibilityLabel={`${label} time`}
          testID={testID}
        />
      </View>
    );
  }
  const open = () =>
    DateTimePickerAndroid.open({
      value: asDate(value),
      mode: 'time',
      onChange: (e, d) => {
        if (e.type === 'set' && d) onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      },
    });
  return (
    <Press onPress={open} style={s.row} accessibilityRole="button" accessibilityLabel={`${label}: ${fmtTime(value)}. Tap to change`} testID={testID}>
      <Text style={[type.small, { flex: 1 }]}>{label}</Text>
      <View style={s.time}>
        <Icon name="clock" size={16} color={color.muted} />
        <Text style={s.timeText}>{fmtTime(value)}</Text>
      </View>
    </Press>
  );
}

const s = themed(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch.min, borderRadius: radius.md },
    time: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      paddingHorizontal: space.md,
      minHeight: 40,
      borderRadius: radius.md,
      backgroundColor: color.surface2,
      borderWidth: 1,
      borderColor: color.glassBorder,
    },
    timeText: { fontFamily: font.bodyBold, fontSize: size.body, color: color.text, fontVariant: ['tabular-nums'] },
    webInput: {
      width: 90,
      minHeight: 40,
      borderRadius: radius.md,
      backgroundColor: color.surface2,
      color: color.text,
      textAlign: 'center',
      fontFamily: font.bodyBold,
      fontSize: size.body,
    },
  }),
);
