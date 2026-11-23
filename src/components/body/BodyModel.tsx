import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONTEXT_NODES, MUSCLE_LABEL, type MuscleId } from '../../data/muscles';
import { color, font, radius, size, space } from '../../theme';
import { Icon } from '../icons';
import { Canvas, MODEL_SRC, snapshotGL, useFrame, useLoader, useThree } from './fiber';

export type Paint = { color: string; glow?: number };
export type PaintMap = Partial<Record<MuscleId, Paint>>;
/** Muscle -> time (ms, Date.now) its glow pulse started. */
export type PulseMap = Partial<Record<MuscleId, number>>;
export type Snapshot = () => Promise<string | null>;

type Controls = { yaw: number; pitch: number; zoom: number; lastTouch: number };

const FRAMING = {
  upper: { target: new THREE.Vector3(0, 0.38, 0), distance: 1.7 },
  full: { target: new THREE.Vector3(0, 0.05, 0), distance: 3.6 },
  torso: { target: new THREE.Vector3(0, 0.3, 0), distance: 2.3 },
};

const PULSE_MS = 900;
const INTRO_MS = 1400;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// ---------- Scene ----------

function Body({
  paint,
  pulses,
  idle,
  onPick,
  onReady,
  controls,
  framing,
  autoRotate,
  intro,
  snapshotRef,
}: {
  paint: PaintMap;
  pulses?: PulseMap;
  idle: string;
  onPick: (m: MuscleId) => void;
  onReady: () => void;
  controls: React.RefObject<Controls>;
  framing: keyof typeof FRAMING;
  autoRotate: boolean;
  intro: boolean;
  snapshotRef?: React.RefObject<Snapshot | null>;
}) {
  // useLoader caches by source, so the model is downloaded and parsed once and reused by every screen.
  const gltf = useLoader(GLTFLoader, MODEL_SRC as string);
  const group = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const born = useRef(0);

  // Each screen gets its own copy of the scene graph with its own materials; geometry is shared.
  const { root, materials } = useMemo(() => {
    const root = gltf.scene.clone(true);
    const materials = new Map<string, THREE.MeshStandardMaterial>();
    for (const region of root.children) {
      const isSkin = region.name === 'context_skin';
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.48,
        metalness: 0.02,
        transparent: isSkin,
        opacity: isSkin ? 0.18 : 1,
        depthWrite: !isSkin,
      });
      mat.userData.baseGlow = 0;
      materials.set(region.name, mat);
      region.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.material = mat;
        o.userData.region = region.name;
      });
    }
    return { root, materials };
  }, [gltf]);

  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  // Colour every region from the paint map.
  useEffect(() => {
    materials.forEach((mat, name) => {
      if (CONTEXT_NODES.has(name)) {
        mat.color.set(color.muscleContext);
        mat.emissive.set(color.noGlow);
        mat.userData.baseGlow = 0;
        return;
      }
      const p = paint[name as MuscleId];
      mat.color.set(p?.color ?? idle);
      mat.emissive.set(p?.color ?? color.noGlow);
      mat.userData.baseGlow = p?.glow ?? 0;
      mat.emissiveIntensity = mat.userData.baseGlow;
    });
  }, [paint, idle, materials]);

  useEffect(() => {
    if (snapshotRef) snapshotRef.current = () => snapshotGL(gl as never);
  }, [gl, snapshotRef]);

  useEffect(onReady, [onReady]);

  // R3F's per-frame callback: mutating refs, the scene and the camera here is the intended pattern.
  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    const c = controls.current;
    const g = group.current;
    if (!c || !g) return;
    const now = Date.now();
    if (!born.current) born.current = now;
    let zoom = c.zoom;
    let yaw = c.yaw;
    if (intro) {
      // Spin in: a turn and a half while zooming from far away.
      const t = Math.min(1, (now - born.current) / INTRO_MS);
      const e = easeOutCubic(t);
      yaw = c.yaw - (1 - e) * Math.PI * 3;
      zoom = c.zoom * (0.45 + 0.55 * e);
    }
    if (autoRotate && now - c.lastTouch > 2500 && (!intro || now - born.current > INTRO_MS)) c.yaw += delta * 0.4;
    g.rotation.y = yaw;
    g.rotation.x = c.pitch;
    const f = FRAMING[framing];
    const d = f.distance / zoom;
    camera.position.set(f.target.x, f.target.y + 0.05, f.target.z + d);
    camera.lookAt(f.target);
    // Glow pulses: a bright flash that settles back to the muscle's steady glow.
    if (pulses) {
      for (const [m, t0] of Object.entries(pulses)) {
        const mat = materials.get(m);
        if (!mat || !t0) continue;
        const k = (now - t0) / PULSE_MS;
        const extra = k < 0 || k > 1 ? 0 : Math.sin(Math.PI * Math.min(1, k * 1.4)) * 1.4 * (1 - k);
        mat.emissiveIntensity = mat.userData.baseGlow + extra;
      }
    }
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <group ref={group}>
      <primitive
        object={root}
        onClick={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
          e.stopPropagation();
          const name = e.object.userData.region as string;
          if (name && !CONTEXT_NODES.has(name)) onPick(name as MuscleId);
        }}
      />
    </group>
  );
}

class GLBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <View style={s.center}>
          <Icon name="body" size={40} color={color.subtle} />
          <Text style={s.msg}>3D view isn’t available on this device.</Text>
        </View>
      );
    return this.props.children;
  }
}

function LoadingPulse({ tint }: { tint: string }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(0.4);
  useEffect(() => {
    if (!reduce) o.set(withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0.4, { duration: 600 })), -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.9 + o.value * 0.1 }] }));
  return (
    <View style={[StyleSheet.absoluteFill, s.center]} pointerEvents="none" accessibilityLabel="Loading 3D muscles">
      <Animated.View style={st}>
        <Icon name="body" size={56} color={tint} filled />
      </Animated.View>
      <Text style={s.msg}>Warming up the muscles…</Text>
    </View>
  );
}

// ---------- Public component ----------

/**
 * Interactive 3D muscle model. Drag to rotate, pinch to zoom, tap a muscle for its name.
 * `paint` colours muscles; everything else uses `idle`. `pulses` flashes muscles.
 */
export function BodyModel({
  paint,
  pulses,
  idle = color.muscleIdle,
  height = 320,
  framing = 'upper',
  autoRotate = true,
  intro = false,
  describe,
  startYaw = 0,
  tint = color.accent,
  background = 'transparent',
  showHint = true,
  interactive = true,
  snapshotRef,
}: {
  paint: PaintMap;
  pulses?: PulseMap;
  idle?: string;
  height?: number;
  framing?: keyof typeof FRAMING;
  autoRotate?: boolean;
  /** Spin and zoom in when first shown. */
  intro?: boolean;
  /** Text shown when a muscle is tapped. */
  describe?: (m: MuscleId) => string;
  startYaw?: number;
  tint?: string;
  background?: string;
  showHint?: boolean;
  /** False inside swipe cards: no drag/pinch/tap, so the card's swipe always wins. */
  interactive?: boolean;
  /** Receives a function that returns a PNG of the current frame. */
  snapshotRef?: React.RefObject<Snapshot | null>;
}) {
  const reduce = useReducedMotion();
  const controls = useRef<Controls>({ yaw: startYaw, pitch: 0, zoom: 1, lastTouch: 0 });
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<MuscleId | null>(null);
  const onReady = useMemo(() => () => setReady(true), []);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const start = useRef({ yaw: 0, pitch: 0 });

  // Gesture handlers run on touch events, not during render.
  /* eslint-disable react-hooks/refs, react-hooks/purity */
  const responder = useMemo(
    () =>
      PanResponder.create({
        // Let taps through to the 3D canvas; take over once the finger moves.
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6 || g.numberActiveTouches > 1,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = { yaw: controls.current.yaw, pitch: controls.current.pitch };
          pinch.current = null;
        },
        onPanResponderMove: (e, g) => {
          const c = controls.current;
          c.lastTouch = Date.now();
          const t = e.nativeEvent.touches;
          if (t && t.length >= 2) {
            const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
            if (!pinch.current) pinch.current = { dist: d, zoom: c.zoom };
            c.zoom = Math.min(2.6, Math.max(0.7, pinch.current.zoom * (d / pinch.current.dist)));
            return;
          }
          c.yaw = start.current.yaw + g.dx * 0.012;
          c.pitch = Math.max(-0.5, Math.min(0.5, start.current.pitch + g.dy * 0.006));
        },
        onPanResponderRelease: () => {
          controls.current.lastTouch = Date.now();
          pinch.current = null;
        },
      }),
    [],
  );
  /* eslint-enable react-hooks/refs, react-hooks/purity */

  return (
    <View style={[s.wrap, { height, backgroundColor: background }]} {...(interactive ? responder.panHandlers : {})} pointerEvents={interactive ? 'auto' : 'none'}>
      <GLBoundary>
        <Canvas
          camera={{ fov: 30, near: 0.05, far: 20, position: [0, 0.4, 1.7] }}
          gl={{ antialias: true, preserveDrawingBuffer: !!snapshotRef }}
          style={{ flex: 1 }}
          onPointerMissed={() => setPicked(null)}
        >
          <ambientLight intensity={0.55} />
          <hemisphereLight args={[color.text, color.bg, 0.6]} />
          <directionalLight position={[2, 3, 4]} intensity={2.2} />
          <directionalLight position={[-3, 1.5, -2]} intensity={1.2} color={tint} />
          <directionalLight position={[0, -2, 3]} intensity={0.3} />
          <Suspense fallback={null}>
            <Body
              paint={paint}
              pulses={pulses}
              idle={idle}
              onPick={(m) => setPicked(m)}
              onReady={onReady}
              controls={controls}
              framing={framing}
              autoRotate={autoRotate && !reduce}
              intro={intro && !reduce}
              snapshotRef={snapshotRef}
            />
          </Suspense>
        </Canvas>
        {!ready && <LoadingPulse tint={tint} />}
      </GLBoundary>
      {picked && (
        <View style={s.tag} pointerEvents="none" accessibilityLiveRegion="polite">
          <View style={[s.dot, { backgroundColor: paint[picked]?.color ?? idle }]} />
          <Text style={s.tagText}>{describe ? describe(picked) : MUSCLE_LABEL[picked]}</Text>
        </View>
      )}
      {showHint && interactive && (
        <View style={s.hint} pointerEvents="none">
          <Icon name="hand" size={14} color={color.subtle} />
          <Text style={s.hintText}>Drag · pinch · tap a muscle</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', borderRadius: radius.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl },
  msg: { fontFamily: font.bodySemi, fontSize: size.small, color: color.muted, textAlign: 'center' },
  tag: {
    position: 'absolute',
    top: space.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.scrim,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  dot: { width: 12, height: 12, borderRadius: radius.pill },
  tagText: { fontFamily: font.bodyBold, fontSize: size.small, color: color.text },
  hint: { position: 'absolute', bottom: space.md, right: space.md, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  hintText: { fontFamily: font.body, fontSize: size.tiny, color: color.subtle },
});
