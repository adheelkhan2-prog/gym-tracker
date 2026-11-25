// Your own exercise video: "Import video from gallery" (any video already on the phone), then trim
// it to a short loop. No camera: the app never records. The clip is copied into this app's own
// storage ON THE PHONE (never bundled in the app, never in the repo, never uploaded) and replaces the
// default video for that exercise until you reset it.
//
// Trimming doesn't re-encode the file: we keep the start and end you pick, and the player loops just
// that part (LoopVideo start/end). Fully offline, instant, no quality loss.
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { crumb, logCrash } from '../crash';
import { EXERCISES } from '../data/exercises';
import { haptic } from '../feedback';
import { safeRequire } from '../safe';
import { clampTrim, defaultTrim, MAX_LOOP, MIN_LOOP, TRIM_STEP } from '../ownVideo';
import { useStore, type OwnVideo } from '../store';
import { color, font, radius, size, space, themed, type } from '../theme';
import { Icon } from './icons';
import { LoopVideo } from './LoopVideo';
import { VideoSheetScope } from './videoPoolCore';
import { Sheet } from './Sheet';
import { Button, Press } from './ui';

const STEP = TRIM_STEP;

type Picker = typeof import('expo-image-picker');
type FS = typeof import('expo-file-system');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded optional native module
const picker = () => (Platform.OS === 'web' ? null : safeRequire<Picker>('expo-image-picker', () => require('expo-image-picker')));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded optional native module
const fs = () => (Platform.OS === 'web' ? null : safeRequire<FS>('expo-file-system', () => require('expo-file-system')));

/** Copy a recorded/imported clip into the app's own storage (Documents/videos), returning its uri. */
function keep(srcUri: string, exerciseId: string): string {
  const f = fs()!;
  const dir = new f.Directory(f.Paths.document, 'videos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const ext = (srcUri.match(/\.(mp4|mov|m4v|webm|3gp|mkv)$/i)?.[1] ?? 'mp4').toLowerCase();
  const dest = new f.File(dir, `${exerciseId}-${Date.now()}.${ext}`);
  new f.File(srcUri).copy(dest);
  return dest.uri;
}

/** Delete a clip we kept earlier (ignores files that are already gone). */
function forget(uri: string | undefined) {
  if (!uri) return;
  try {
    const f = fs();
    const file = f ? new f.File(uri) : null;
    if (file?.exists) file.delete();
  } catch (e) {
    logCrash('error', e, 'deleting own video');
  }
}

/**
 * The two buttons every exercise gets, plus "Trim" and "Reset to default" once you have your own.
 * Picking a clip opens the trim sheet straight away.
 */
export function OwnVideoButtons({ exerciseId }: { exerciseId: string }) {
  const { state, update } = useStore();
  const [trim, setTrim] = useState<(OwnVideo & { duration: number; fresh: boolean }) | null>(null);
  const [msg, setMsg] = useState('');
  const mine = state.userVideos[exerciseId];
  const name = EXERCISES[exerciseId]?.name ?? 'this exercise';
  if (!picker() || !fs()) return null;

  const importVideo = async () => {
    const p = picker()!;
    setMsg('');
    crumb(`own video: gallery ${exerciseId}`);
    try {
      // Any length can be imported; you trim it to a loop of up to 6 s next.
      const res = await p.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
      const a = res.canceled ? null : res.assets?.[0];
      if (!a) return;
      const uri = keep(a.uri, exerciseId);
      const duration = a.duration ? a.duration / 1000 : 0;
      setTrim({ uri, ...defaultTrim(duration), duration, fresh: true });
    } catch (e) {
      logCrash('error', e, 'own video');
      setMsg('Couldn’t use that video. Try another one.');
    }
  };

  const save = (v: OwnVideo) => {
    if (mine && mine.uri !== v.uri) forget(mine.uri);
    update((s) => ({ ...s, userVideos: { ...s.userVideos, [exerciseId]: v } }));
    haptic.setDone();
    setTrim(null);
  };

  const cancel = () => {
    if (trim?.fresh) forget(trim.uri); // a new clip you didn't keep
    setTrim(null);
  };

  const reset = () => {
    forget(mine?.uri);
    update((s) => {
      const { [exerciseId]: _, ...rest } = s.userVideos;
      void _;
      return { ...s, userVideos: rest };
    });
    haptic.tap();
  };

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Button size="sm" variant="outline" icon="video" label="Import video from gallery" accessibilityLabel={`Import a video of ${name} from the gallery`} onPress={() => void importVideo()} />
      </View>
      {mine && (
        <View style={s.row}>
          <Button size="sm" variant="ghost" icon="edit" label="Trim my video" onPress={() => setTrim({ ...mine, duration: 0, fresh: false })} />
          <Button size="sm" variant="ghost" icon="rotate" label="Reset to default" accessibilityLabel={`Reset ${name} to the default video`} onPress={reset} />
        </View>
      )}
      {msg ? <Text style={[type.small, { color: color.warn }]}>{msg}</Text> : null}
      {trim && <TrimSheet name={name} clip={trim} onSave={save} onCancel={cancel} />}
    </View>
  );
}

/** Pick which part of the clip loops: a start point and a length (1–6 s), previewed live. */
function TrimSheet({ name, clip, onSave, onCancel }: { name: string; clip: OwnVideo & { duration: number }; onSave: (v: OwnVideo) => void; onCancel: () => void }) {
  const [duration, setDuration] = useState(clip.duration);
  const [start, setStart] = useState(clip.start);
  const [length, setLength] = useState(clip.end - clip.start);
  const t = clampTrim(start, length, duration);
  const known = duration > 0;
  return (
    <Sheet title="Trim to a short loop" subtitle={`${name}. Pick where the loop starts and how long it is (up to ${MAX_LOOP} s).`} onClose={onCancel} testID="trim-sheet">
      <View style={{ gap: space.md }}>
        <View style={s.preview}>
          <VideoSheetScope>
            <LoopVideo source={{ uri: clip.uri }} paused={false} start={t.start} end={t.end} onDuration={(d) => d > 0 && setDuration(d)} />
          </VideoSheetScope>
        </View>
        <Text style={[type.small, { textAlign: 'center' }]}>
          Loop: {t.start.toFixed(1)} s → {t.end.toFixed(1)} s{known ? ` of ${duration.toFixed(1)} s` : ''}
        </Text>
        <Stepper label="Start" value={`${t.start.toFixed(1)} s`} onMinus={() => setStart(Math.max(0, t.start - STEP))} onPlus={() => setStart(t.start + STEP)} />
        <Stepper label="Length" value={`${(t.end - t.start).toFixed(1)} s`} onMinus={() => setLength(Math.max(MIN_LOOP, t.end - t.start - STEP))} onPlus={() => setLength(Math.min(MAX_LOOP, t.end - t.start + STEP))} />
        <Button icon="check" label="Save loop" onPress={() => onSave({ uri: clip.uri, start: t.start, end: t.end })} />
        <Text style={[type.small, { fontSize: size.tiny }]}>Saved only in this app on your phone. Delete it any time with “Reset to default”.</Text>
      </View>
    </Sheet>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={s.stepper}>
      <Text style={[type.label, { width: 64 }]}>{label}</Text>
      <Press onPress={onMinus} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`${label} earlier / shorter`}>
        <Icon name="minus" size={18} color={color.text} />
      </Press>
      <Text style={s.stepValue} accessibilityLiveRegion="polite">
        {value}
      </Text>
      <Press onPress={onPlus} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={`${label} later / longer`}>
        <Icon name="plus" size={18} color={color.text} />
      </Press>
    </View>
  );
}

const s = themed(() =>
  StyleSheet.create({
    wrap: { gap: space.xs },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    preview: { height: 240, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.stage },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    stepBtn: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2 },
    stepValue: { flex: 1, textAlign: 'center', fontFamily: font.display, fontSize: size.h3, color: color.text },
  }),
);
