// Share the crash log as a text file (Android share sheet), or copy-free fallback on web.
import { Platform } from 'react-native';
import { crashLogText } from './crash';

export async function shareCrashLog() {
  const text = crashLogText();
  if (Platform.OS === 'web') {
    console.log(text);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const f = new File(Paths.cache, 'gym-tracker-crash-log.txt');
  if (f.exists) f.delete();
  f.create();
  f.writeSync(text);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'text/plain', dialogTitle: 'Gym Tracker crash log' });
}
