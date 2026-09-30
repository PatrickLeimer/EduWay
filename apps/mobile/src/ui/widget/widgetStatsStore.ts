/**
 * The widget's last stats, saved in the app's documents folder. Android draws
 * the widget from a background task (androidWidget.tsx) that can't reach the
 * server, so it reads what the app saved here. Only these few numbers are kept.
 */
import { File, Paths } from 'expo-file-system';

import { EMPTY_WIDGET_STATS, parseWidgetStats, type WidgetStats } from '../lib/widgetStats';

const statsFile = () => new File(Paths.document, 'drive-widget.json');

export function loadWidgetStats(): WidgetStats {
  try {
    const file = statsFile();
    return (file.exists ? parseWidgetStats(file.textSync()) : null) ?? EMPTY_WIDGET_STATS;
  } catch {
    return EMPTY_WIDGET_STATS;
  }
}

export function saveWidgetStats(stats: WidgetStats): void {
  try {
    const file = statsFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(stats));
  } catch (e) {
    console.warn('[widget] could not save stats:', e);
  }
}
