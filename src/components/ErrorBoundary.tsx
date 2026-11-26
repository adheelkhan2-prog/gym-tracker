import React, { Component } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { logCrash } from '../crash';
import { color, font, size, space, themed, type } from '../theme';
import { Icon } from './icons';
import { Button } from './ui';

type Props = { children: React.ReactNode; onShareLog?: () => void };

/**
 * Catches errors thrown while rendering: logs them (with the recent steps) and shows a calm
 * recovery screen instead of closing the app. Saved data is untouched; "Try again" re-renders.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logCrash('render', error, info.componentStack?.split('\n').filter(Boolean)[0]?.trim());
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={s.wrap} accessibilityRole="alert">
        <Icon name="alert" size={36} color={color.warn} />
        <Text style={[type.title, { textAlign: 'center' }]}>Something went wrong</Text>
        <Text style={[type.bodyMuted, { textAlign: 'center' }]}>
          Your workouts are saved. The error was written to the crash log (Settings → Crash log).
        </Text>
        <Text style={s.msg} numberOfLines={3}>
          {this.state.error.message}
        </Text>
        <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
          <Button label="Try again" icon="rotate" onPress={() => this.setState({ error: null })} />
          {this.props.onShareLog && <Button variant="secondary" icon="share" label="Share crash log" onPress={this.props.onShareLog} />}
        </View>
      </View>
    );
  }
}

const s = themed(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.x3 },
  msg: { fontFamily: font.bodySemi, fontSize: size.small, color: color.subtle, textAlign: 'center' },
}));
