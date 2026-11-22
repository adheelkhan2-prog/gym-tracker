import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { color, font, size, space, type } from '../theme';

export type Point = { label: string; value: number; detail: string };

/**
 * Single-series line chart: 2px lime line over a soft area fill, hairline solid grid,
 * end dot with a surface ring. Tap anywhere to read the nearest session.
 */
export function LineChart({ points, unit, height = 200 }: { points: Point[]; unit: string; height?: number }) {
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const padL = 8;
  const padR = 44;
  const padT = 14;
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
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `${line} L${x(points.length - 1)},${padT + plotH} L${x(0)},${padT + plotH} Z` : '';
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
        <Text style={[type.num, { fontSize: size.display }]}>
          {points[active].value} <Text style={s.unit}>{unit}</Text>
        </Text>
        <Text style={type.small}>
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
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color.lime} stopOpacity={0.28} />
                <Stop offset="1" stopColor={color.lime} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {grid.map((g, i) => (
              <Line key={i} x1={padL} x2={width - padR + 6} y1={y(g)} y2={y(g)} stroke={color.line} strokeWidth={1} />
            ))}
            {grid.map((g, i) => (
              <SvgText key={`t${i}`} x={width - 2} y={y(g) + 4} fill={color.subtle} fontSize={11} fontFamily={font.body} textAnchor="end">
                {Math.round(g)}
              </SvgText>
            ))}
            {area ? <Path d={area} fill="url(#fill)" /> : null}
            {sel !== null && <Line x1={x(sel)} x2={x(sel)} y1={padT} y2={padT + plotH} stroke={color.muted} strokeWidth={1} />}
            <Path d={line} stroke={color.lime} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) =>
              i === active || i === last ? (
                <Circle key={i} cx={x(i)} cy={y(p.value)} r={6} fill={color.lime} stroke={color.surface} strokeWidth={2} />
              ) : null,
            )}
            <SvgText x={padL} y={height - 6} fill={color.subtle} fontSize={11} fontFamily={font.body}>
              {points[0].label}
            </SvgText>
            {points.length > 1 && (
              <SvgText x={x(last)} y={height - 6} fill={color.subtle} fontSize={11} fontFamily={font.body} textAnchor="end">
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
  readout: { marginBottom: space.sm },
  unit: { fontFamily: font.bodySemi, fontSize: size.body, color: color.muted },
});
