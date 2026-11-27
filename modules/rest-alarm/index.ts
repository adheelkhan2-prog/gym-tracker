// The rest timer's native side (Android only; null elsewhere or if the module can't load).
import { requireOptionalNativeModule } from 'expo';

type RestAlarm = {
  /** Ongoing notification counting down to `endsAt` (epoch ms), drawn by Android (no app updates). False below Android 8. */
  showCountdown(endsAt: number, title: string, body: string, channelId: string, color: string): Promise<boolean>;
  cancelCountdown(): Promise<void>;
  /** True when Android's battery optimisation leaves this app alone. */
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  /** Ask to turn battery optimisation off for this app (system dialog, else the settings list). */
  openBatteryOptimization(): Promise<boolean>;
  /** Huawei / Honor: their own "App launch" manager, where the app can be set to Manage manually. */
  openOemBatterySettings(): Promise<boolean>;
  /** "huawei", "honor", ... (Build.MANUFACTURER, lower case). */
  manufacturer(): Promise<string>;
};

export default requireOptionalNativeModule<RestAlarm>('RestAlarm');
