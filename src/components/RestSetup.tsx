// "Keep the rest timer on time": asked once on first launch (Android), and from Settings. Phones such
// as Huawei hold back alarms of apps under battery optimisation, so the "Rest is over" alert could
// come late. Each button opens the right system setting; the state is re-checked on return.
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import RestAlarm from '../../modules/rest-alarm';
import { NOTIFY_OK, Notifications } from '../notifications';
import { color, font, size, space, themed, type } from '../theme';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { Button } from './ui';

export type RestSetupStatus = { battery: boolean; exact: boolean; notify: boolean; oem: boolean };

/** What's already set up for an on-time rest alarm (everything true off Android). */
export async function restSetupStatus(): Promise<RestSetupStatus> {
  if (Platform.OS !== 'android' || !RestAlarm) return { battery: true, exact: true, notify: true, oem: false };
  const [battery, exact, notify, maker] = await Promise.all([
    RestAlarm.isIgnoringBatteryOptimizations().catch(() => true),
    NOTIFY_OK ? Notifications.getExactAlarmPermissionsAsync().then((p) => p.granted).catch(() => true) : Promise.resolve(true),
    NOTIFY_OK ? Notifications.getPermissionsAsync().then((p) => p.granted).catch(() => true) : Promise.resolve(true),
    RestAlarm.manufacturer().catch(() => ''),
  ]);
  return { battery, exact, notify, oem: maker === 'huawei' || maker === 'honor' };
}

/** Nothing left to ask (Huawei / Honor always get the sheet once, for their own App launch step). */
export const restSetupDone = (s: RestSetupStatus) => s.battery && s.exact && s.notify && !s.oem;

export function RestSetupSheet({ onClose }: { onClose: () => void }) {
  const [st, setSt] = useState<RestSetupStatus | null>(null);
  const refresh = useCallback(() => {
    restSetupStatus().then(setSt).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    // Coming back from a system settings screen: show what changed.
    const sub = AppState.addEventListener('change', (a) => a === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  return (
    <Sheet
      title="Keep the rest timer on time"
      subtitle="So “Rest is over” buzzes at 0:00, even with the screen off."
      onClose={onClose}
      testID="rest-setup"
      footer={<Button variant="ghost" label={st && st.battery && st.exact && st.notify && !st.oem ? 'Done' : 'Not now'} onPress={onClose} testID="rest-setup-close" />}
    >
      <View style={{ gap: space.md }}>
        <Step
          done={!!st?.notify}
          title="Notifications"
          text="The countdown on the lock screen and the alert at the end."
          action={
            st && !st.notify ? (
              <Button size="sm" label="Allow" onPress={() => Notifications.requestPermissionsAsync().then(refresh, refresh)} testID="rest-setup-notify" />
            ) : null
          }
        />
        <Step
          done={!!st?.exact}
          title="Alarms at the exact time"
          text="Lets the end-of-rest alert be an exact alarm."
          action={
            st && !st.exact ? (
              <Button size="sm" label="Allow" onPress={() => Notifications.requestExactAlarmPermissionsAsync().then(refresh, refresh)} testID="rest-setup-exact" />
            ) : null
          }
        />
        <Step
          done={!!st?.battery}
          title="Battery optimisation off for this app"
          text="Otherwise the phone may hold the alert back to save battery."
          action={
            st && !st.battery ? (
              <Button size="sm" label="Turn off" onPress={() => RestAlarm?.openBatteryOptimization().catch(() => false)} testID="rest-setup-battery" />
            ) : null
          }
        />
        {st?.oem && (
          <Step
            done={false}
            info
            title="Huawei: App launch"
            text="In App launch, set Gym Tracker to Manage manually and keep Run in background on."
            action={<Button size="sm" variant="outline" label="Open" onPress={() => RestAlarm?.openOemBatterySettings().catch(() => false)} testID="rest-setup-oem" />}
          />
        )}
      </View>
    </Sheet>
  );
}

function Step({ done, info, title, text, action }: { done: boolean; info?: boolean; title: string; text: string; action: React.ReactNode }) {
  return (
    <View style={s.step} accessibilityLabel={`${title}: ${info ? '' : done ? 'done' : 'not set up'}`}>
      <View style={[s.mark, done && s.markDone]}>
        <Icon name={done ? 'check' : info ? 'info' : 'alert'} size={16} color={done ? color.onAccent : color.muted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.h3}>{title}</Text>
        <Text style={s.text}>{text}</Text>
      </View>
      {!done && action}
    </View>
  );
}

const s = themed(() =>
  StyleSheet.create({
    step: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    mark: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface2 },
    markDone: { backgroundColor: color.accent },
    text: { fontFamily: font.body, fontSize: size.small, color: color.muted },
  }),
);
