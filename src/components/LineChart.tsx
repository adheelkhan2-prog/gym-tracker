import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { C, font } from '../theme';

export type Point = { label: string; value: number; detail: string };

/**
 * Single-series line chart: 2px line, 8px end dots with a surface ring,
 * hairline solid gridlines, value labelled at the line end. Tap anywhere to
 * select the nearest session (the mobile equivalent of hover).
 */
export function LineChart({ points, unit, height = 190 }: { points: Point[]; unit: string; height?: number }) {
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const padL = 8;
  const padR = 56; // room for the end label
  const padT = 16;
  const padB = 24;

  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) {
    lo -= 5;
    hi += 5;
  }
  const span = hi - lo;
  lo = Math.max(0, lo - span * 0.15);
  hi = hi + span * 0.15;

  const plotW = Math.max(1, width - padL - padR);
  const plotH = height - padT - padB;
  const x = (i: number) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * plotH;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1].map((t) => lo + t * (hi - lo));
  const last = points.length - 1;
  const active = sel ?? last;

  const pick = (px: number) => {
    if (points.length < 2) return setSel(0);
    const i = Math.round(((px - padL) / plotW) * (points.length - 1));
    setSel(Math.max(0, Math.min(last, i)));
  };

  return (
    <View>
      <View style={s.readout}>
        <Text style={[s.readoutValue, font.num]}>
          {points[active].value} <Text style={s.readoutUnit}>{unit}</Text>
        </Text>
        <Text style={s.readoutDetail}>
          {points[active].label} · {points[active].detail}
        </Text>
      </View>
      <Pressable
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onPressIn={(e) => pick(e.nativeEvent.locationX)}
        accessibilityLabel={`Chart of ${points.length} sessions. Latest ${points[last].value} ${unit}.`}
      >
        {width > 0 && (
          <Svg width={width} height={height}>
            {grid.map((g, i) => (
              <Line key={i} x1={padL} x2={width - padR + 8} y1={y(g)} y2={y(g)} stroke={C.line} strokeWidth={1} />
            ))}
            {grid.map((g, i) => (
              <SvgText key={`t${i}`} x={width - 4} y={y(g) + 4} fill={C.faint} fontSize={10} fontFamily="sans-serif" textAnchor="end">
                {Math.round(g)}
              </SvgText>
            ))}
            {sel !== null && (
              <Line x1={x(sel)} x2={x(sel)} y1={padT} y2={padT + plotH} stroke={C.muted} strokeWidth={1} />
            )}
            <Path d={d} stroke={C.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) =>
              i === active || i === last ? (
                <Circle key={i} cx={x(i)} cy={y(p.value)} r={5} fill={C.accent} stroke={C.surface} strokeWidth={2} />
              ) : null,
            )}
            <SvgText x={padL} y={height - 6} fill={C.faint} fontSize={10} fontFamily="sans-serif">
              {points[0].label}
            </SvgText>
            {points.length > 1 && (
              <SvgText x={x(last)} y={height - 6} fill={C.faint} fontSize={10} fontFamily="sans-serif" textAnchor="end">
                {points[last].label}
              </SvgText>
            )}
          </Svg>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  readout: { marginBottom: 8 },
  readoutValue: { color: C.text, fontSize: 28, fontWeight: '800' },
  readoutUnit: { color: C.muted, fontSize: 15, fontWeight: '600' },
  readoutDetail: { color: C.muted, fontSize: 13, marginTop: 2 },
});
