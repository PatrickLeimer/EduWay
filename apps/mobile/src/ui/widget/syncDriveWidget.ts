/**
 * Entry points for the home-screen Drive widget. Both widget libraries throw
 * when imported in Expo Go, so they are required lazily after the checks in
 * nativeWidgets.ts; everything here is a no-op in Expo Go.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- lazy, see above */
import { DRIVE_LINK_URL } from '../../trip';
import type { WidgetStats } from '../lib/widgetStats';
import { colors, font } from '../theme';
import { hasAndroidWidgets, hasIosWidgets } from './nativeWidgets';
import { saveWidgetStats } from './widgetStatsStore';

/** Called once from index.ts: lets Android draw the widget from a background task. */
export function registerDriveWidget(): void {
  if (!hasAndroidWidgets()) return;
  const android = require('./androidWidget') as typeof import('./androidWidget');
  android.registerAndroidDriveWidget();
}

/** Saves the stats and redraws the widget on this phone. */
export function syncDriveWidget(stats: WidgetStats): void {
  try {
    if (hasAndroidWidgets()) {
      saveWidgetStats(stats);
      const android = require('./androidWidget') as typeof import('./androidWidget');
      void android.updateAndroidDriveWidget(stats).catch((e: unknown) => {
        console.warn('[widget] could not redraw the Drive widget:', e);
      });
    } else if (hasIosWidgets()) {
      // The iPhone widget can't import theme.ts, so its look travels with the stats.
      const ios = require('./iosDriveWidget') as typeof import('./iosDriveWidget');
      ios.DriveWidget.updateSnapshot({
        url: DRIVE_LINK_URL,
        streak: String(stats.streak),
        streakLabel: stats.streakLabel,
        lastLine: stats.lastLine,
        background: colors.primary,
        text: colors.onColor,
        textMuted: colors.teal100,
        ctaSize: font.body,
        streakSize: font.display,
        labelSize: font.small,
        lastSize: font.tiny,
      });
    }
  } catch (e) {
    console.warn('[widget] could not update the Drive widget:', e);
  }
}
