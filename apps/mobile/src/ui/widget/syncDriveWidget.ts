/**
 * Sends the iPhone widget its look (theme tokens) and link. The widget can't
 * import theme.ts (see iosDriveWidget.tsx), so the app pushes them on launch.
 * No-op on Android (AndroidDriveWidget.tsx renders from the theme directly)
 * and in Expo Go, which has no widget module.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { DRIVE_LINK_URL } from '../../trip';
import { colors, font } from '../theme';

export function syncDriveWidget(): void {
  if (Platform.OS !== 'ios' || !requireOptionalNativeModule('ExpoWidgets')) return;
  try {
    // Lazy: loading expo-widgets without its native module throws.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DriveWidget } = require('./iosDriveWidget') as typeof import('./iosDriveWidget');
    DriveWidget.updateSnapshot({
      url: DRIVE_LINK_URL,
      title: 'Drive',
      brand: 'EduWay',
      background: colors.primary,
      text: colors.onColor,
      textMuted: colors.teal100,
      titleSize: font.title,
      brandSize: font.small,
    });
  } catch (e) {
    console.warn('[widget] could not update the Drive widget:', e);
  }
}
