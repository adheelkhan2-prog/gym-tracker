// Per-screen error boundary for Expo Router: every route file re-exports this as `ErrorBoundary`,
// so an error in one screen shows a recovery panel for that screen only, never closes the app.
import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { logCrash } from '../crash';
import { color, space, themed, type } from '../theme';
import { Icon } from './icons';
import { Button } from './ui';

export function RouteError({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    logCrash('render', error, 'screen');
  }, [error]);
  return (
    <View style={[s.wrap, { backgroundColor: color.bg, gap: space.lg, padding: space.x3 }]} accessibilityRole="alert">
      <Icon name="alert" size={36} color={color.warn} />
      <Text style={[type.title, { textAlign: 'center' }]}>This screen hit a problem</Text>
      <Text style={[type.bodyMuted, { textAlign: 'center' }]}>Your workouts are saved. The details are in Settings → Crash log.</Text>
      <View style={{ alignSelf: 'stretch' }}>
        <Button label="Try again" icon="rotate" onPress={() => void retry()} />
      </View>
    </View>
  );
}

const s = themed(() => StyleSheet.create({ wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' } }));
