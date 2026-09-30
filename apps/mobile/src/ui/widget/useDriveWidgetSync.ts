/**
 * Keeps the home-screen Drive widget current: the saved stats right away when
 * the app opens, then fresh ones from the server (GET /progress), and again
 * after every drive that finishes uploading.
 */
import { DEMO_USER_ID } from '@eduway/shared';
import { useEffect } from 'react';

import { useTripState } from '../../trip';
import { widgetStats } from '../lib/widgetStats';
import type { AppModules } from '../../wiring';
import { syncDriveWidget } from './syncDriveWidget';
import { loadWidgetStats } from './widgetStatsStore';

export function useDriveWidgetSync(modules: AppModules): void {
  const { status } = useTripState(modules.trip);

  useEffect(() => {
    syncDriveWidget(loadWidgetStats());
  }, []);

  useEffect(() => {
    // On open, and once a drive is saved and scored.
    if (status !== 'idle' && status !== 'done') return;
    let alive = true;
    modules.api
      .getProgress(DEMO_USER_ID)
      .then((p) => {
        if (alive) syncDriveWidget(widgetStats(p));
      })
      .catch(() => {
        // Offline: the widget keeps its last stats.
      });
    return () => {
      alive = false;
    };
  }, [modules.api, status]);
}
