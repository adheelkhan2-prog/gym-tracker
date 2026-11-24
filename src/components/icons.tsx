// Gym Tracker's own icon set: chunky 2.6px rounded strokes on a 24px grid,
// with a solid fill for "active" states. One style everywhere, no icon fonts.
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color } from '../theme';

export type IconName =
  | 'barbell'
  | 'chart'
  | 'flask'
  | 'sliders'
  | 'flame'
  | 'trophy'
  | 'check'
  | 'checkCircle'
  | 'back'
  | 'next'
  | 'arrowRight'
  | 'arrowUp'
  | 'arrowDown'
  | 'plus'
  | 'minus'
  | 'timer'
  | 'bandage'
  | 'bolt'
  | 'calendar'
  | 'share'
  | 'close'
  | 'info'
  | 'alert'
  | 'moon'
  | 'swap'
  | 'search'
  | 'edit'
  | 'trash'
  | 'home'
  | 'hand'
  | 'body'
  | 'layers'
  | 'clock'
  | 'rotate'
  | 'stretch'
  | 'link'
  | 'bell'
  | 'sound'
  | 'mute'
  | 'flag'
  | 'chevronDown'
  | 'chevronUp'
  | 'star'
  | 'video';

type Glyph = (c: string, filled: boolean) => React.ReactNode;

const W = 2.6;
const st = (c: string) => ({ stroke: c, strokeWidth: W, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });
const fillOr = (c: string, filled: boolean) => (filled ? c : 'none');

const G: Record<IconName, Glyph> = {
  barbell: (c, f) => (
    <>
      <Rect x={2.5} y={8} width={3.5} height={8} rx={1.4} {...st(c)} fill={fillOr(c, f)} />
      <Rect x={18} y={8} width={3.5} height={8} rx={1.4} {...st(c)} fill={fillOr(c, f)} />
      <Rect x={6} y={5.5} width={3} height={13} rx={1.4} {...st(c)} fill={fillOr(c, f)} />
      <Rect x={15} y={5.5} width={3} height={13} rx={1.4} {...st(c)} fill={fillOr(c, f)} />
      <Path d="M9 12h6" {...st(c)} />
    </>
  ),
  chart: (c, f) => (
    <>
      <Path d="M3.5 17.5l5.5-5.5 4 3.5 7.5-8" {...st(c)} />
      <Path d="M15.5 7.5h5v5" {...st(c)} />
      {f && <Path d="M3.5 21h17" {...st(c)} />}
    </>
  ),
  flask: (c, f) => (
    <>
      <Path d="M9 3h6M10 3v5.5L4.8 17.8A2.2 2.2 0 006.7 21h10.6a2.2 2.2 0 001.9-3.2L14 8.5V3" {...st(c)} />
      <Path d="M7 15h10l2 3.2a1.2 1.2 0 01-1 1.8H6a1.2 1.2 0 01-1-1.8z" fill={fillOr(c, f)} stroke="none" />
    </>
  ),
  sliders: (c, f) => (
    <>
      <Path d="M4 7h9M18 7h2M4 17h3M12 17h8" {...st(c)} />
      <Circle cx={15.5} cy={7} r={2.5} {...st(c)} fill={fillOr(c, f)} />
      <Circle cx={9.5} cy={17} r={2.5} {...st(c)} fill={fillOr(c, f)} />
    </>
  ),
  flame: (c, f) => (
    <Path
      d="M12 2.8c.6 3.2 4.7 5.2 5.6 9.4.8 3.9-1.9 8.6-5.6 8.6s-6.4-2.9-6-6.6c.3-2.6 2-3.9 2.6-5.6.6 1.6 1.4 2.4 2.4 2.8C10.6 8.6 10.7 5.5 12 2.8z"
      {...st(c)}
      fill={fillOr(c, f)}
    />
  ),
  trophy: (c, f) => (
    <>
      <Path d="M7 3.5h10v5.2a5 5 0 01-10 0z" {...st(c)} fill={fillOr(c, f)} />
      <Path d="M7 5.5H4.2v1.2A3.3 3.3 0 007.4 10M17 5.5h2.8v1.2A3.3 3.3 0 0116.6 10M12 13.7V17M8 20.5h8M9.5 17h5" {...st(c)} />
    </>
  ),
  check: (c) => <Path d="M4.5 12.5l4.8 4.8L19.5 7" {...st(c)} strokeWidth={3.2} />,
  checkCircle: (c, f) => (
    <>
      <Circle cx={12} cy={12} r={9} {...st(c)} fill={fillOr(c, f)} />
      <Path d="M8 12.3l2.8 2.8L16.2 9.6" {...st(f ? color.bg : c)} />
    </>
  ),
  back: (c) => <Path d="M14.5 5l-7 7 7 7" {...st(c)} strokeWidth={3} />,
  next: (c) => <Path d="M9.5 5l7 7-7 7" {...st(c)} strokeWidth={3} />,
  chevronDown: (c) => <Path d="M5 9.5l7 7 7-7" {...st(c)} strokeWidth={3} />,
  chevronUp: (c) => <Path d="M5 14.5l7-7 7 7" {...st(c)} strokeWidth={3} />,
  arrowRight: (c) => <Path d="M4 12h15M13 6l6 6-6 6" {...st(c)} strokeWidth={3} />,
  arrowUp: (c) => <Path d="M12 20V5M6 11l6-6 6 6" {...st(c)} strokeWidth={3} />,
  arrowDown: (c) => <Path d="M12 4v15M6 13l6 6 6-6" {...st(c)} strokeWidth={3} />,
  plus: (c) => <Path d="M12 5v14M5 12h14" {...st(c)} strokeWidth={3} />,
  minus: (c) => <Path d="M5 12h14" {...st(c)} strokeWidth={3} />,
  timer: (c, f) => (
    <>
      <Circle cx={12} cy={13.5} r={7.5} {...st(c)} fill={fillOr(c, f)} />
      <Path d="M10 2.8h4M12 13.5V9.5M18.5 6.5l1.5-1.5" {...st(f ? color.bg : c)} />
    </>
  ),
  bandage: (c, f) => (
    <>
      <Rect x={2.5} y={8} width={19} height={8} rx={4} {...st(c)} fill={fillOr(c, f)} transform="rotate(-35 12 12)" />
      <Path d="M10.6 11.2h.01M13.4 12.8h.01M12.8 10.4h.01M11.2 13.6h.01" {...st(f ? color.bg : c)} strokeWidth={2.2} />
    </>
  ),
  bolt: (c, f) => <Path d="M13.5 2.5L5 13.5h6.5l-1 8 8.5-11h-6.5z" {...st(c)} fill={fillOr(c, f)} />,
  calendar: (c, f) => (
    <>
      <Rect x={3.5} y={5} width={17} height={15.5} rx={3.5} {...st(c)} fill={fillOr(c, f)} />
      <Path d="M8 3v4M16 3v4M3.5 10h17" {...st(f ? color.bg : c)} />
    </>
  ),
  share: (c) => (
    <>
      <Path d="M12 15V3.5M7.5 8L12 3.5 16.5 8" {...st(c)} />
      <Path d="M5 12.5v5.5a2.5 2.5 0 002.5 2.5h9a2.5 2.5 0 002.5-2.5v-5.5" {...st(c)} />
    </>
  ),
  close: (c) => <Path d="M6 6l12 12M18 6L6 18" {...st(c)} strokeWidth={3} />,
  info: (c, f) => (
    <>
      <Circle cx={12} cy={12} r={9} {...st(c)} fill={fillOr(c, f)} />
      <Path d="M12 11v5.5M12 7.6h.01" {...st(f ? color.bg : c)} strokeWidth={3} />
    </>
  ),
  alert: (c, f) => (
    <>
      <Path d="M10.3 4.3L2.9 17.5A2 2 0 004.6 20.5h14.8a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z" {...st(c)} fill={fillOr(c, f)} />
      <Path d="M12 9.5v4.2M12 16.8h.01" {...st(f ? color.bg : c)} strokeWidth={3} />
    </>
  ),
  moon: (c, f) => <Path d="M19.5 14.6A8 8 0 019.4 4.5 8 8 0 1019.5 14.6z" {...st(c)} fill={fillOr(c, f)} />,
  swap: (c) => <Path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" {...st(c)} />,
  search: (c) => (
    <>
      <Circle cx={10.5} cy={10.5} r={6.5} {...st(c)} />
      <Path d="M15.5 15.5L20 20" {...st(c)} />
    </>
  ),
  edit: (c) => <Path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16zM13.5 6.5l4 4" {...st(c)} />,
  trash: (c) => <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5a1.8 1.8 0 001.8 1.5h5.4a1.8 1.8 0 001.8-1.5l1-12.5M10 11v6M14 11v6" {...st(c)} />,
  home: (c, f) => <Path d="M3.5 11L12 3.8l8.5 7.2V19a1.8 1.8 0 01-1.8 1.8h-3.9v-5.6H9.2v5.6H5.3A1.8 1.8 0 013.5 19z" {...st(c)} fill={fillOr(c, f)} />,
  hand: (c) => (
    <Path
      d="M8 12V5.5a1.6 1.6 0 013.2 0V11M11.2 10V4a1.6 1.6 0 013.2 0v6.5M14.4 10.5V6a1.6 1.6 0 013.2 0v8.2c0 4-2.6 6.8-6.3 6.8-2.6 0-4-1.2-5.4-3.3L3.5 13.8a1.6 1.6 0 012.6-1.8L8 14.5"
      {...st(c)}
    />
  ),
  body: (c, f) => (
    <>
      <Circle cx={12} cy={4.5} r={2.3} {...st(c)} fill={fillOr(c, f)} />
      <Path d="M5 9.2c2.4 1 4.6 1.4 7 1.4s4.6-.4 7-1.4M12 10.6v4.6M12 15.2l-3 6M12 15.2l3 6" {...st(c)} />
    </>
  ),
  layers: (c, f) => (
    <>
      <Path d="M12 3.5l9 4.8-9 4.8-9-4.8z" {...st(c)} fill={fillOr(c, f)} />
      <Path d="M3 12.6l9 4.8 9-4.8M3 16.8l9 4.8 9-4.8" {...st(c)} />
    </>
  ),
  clock: (c, f) => (
    <>
      <Circle cx={12} cy={12} r={9} {...st(c)} fill={fillOr(c, f)} />
      <Path d="M12 7v5.3l3.3 2" {...st(f ? color.bg : c)} />
    </>
  ),
  rotate: (c) => <Path d="M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4.5v4.2h-4.2" {...st(c)} />,
  stretch: (c) => <Path d="M4 20L20 4M14 4h6v6M10 20H4v-6" {...st(c)} />,
  link: (c) => <Path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10" {...st(c)} />,
  bell: (c, f) => (
    <>
      <Path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z" {...st(c)} fill={fillOr(c, f)} />
      <Path d="M10 21h4" {...st(c)} />
    </>
  ),
  sound: (c, f) => (
    <>
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" {...st(c)} fill={fillOr(c, f)} />
      <Path d="M15.5 9a4 4 0 010 6M18.3 6.5a7.5 7.5 0 010 11" {...st(c)} />
    </>
  ),
  mute: (c, f) => (
    <>
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" {...st(c)} fill={fillOr(c, f)} />
      <Path d="M16 9.5l5 5M21 9.5l-5 5" {...st(c)} />
    </>
  ),
  flag: (c, f) => (
    <>
      <Path d="M5 21V4" {...st(c)} />
      <Path d="M5 4.5h11.5l-2 4 2 4H5" {...st(c)} fill={fillOr(c, f)} />
    </>
  ),
  video: (c, f) => (
    <>
      <Rect x={3} y={6} width={13} height={12} rx={2.5} {...st(c)} fill={fillOr(c, f)} />
      <Path d="M16 10.5l5-3v9l-5-3" {...st(c)} />
    </>
  ),
  star: (c, f) => (
    <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" {...st(c)} fill={fillOr(c, f)} />
  ),
};

export function Icon({ name, size = 24, color, filled = false }: { name: IconName; size?: number; color: string; filled?: boolean }) {
  // Wrapped in a View so it stacks above glass layers on web (bare SVG isn't positioned there).
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
        {G[name](color, filled)}
      </Svg>
    </View>
  );
}
