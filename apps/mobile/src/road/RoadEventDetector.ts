/**
 * Real speeding + rolling stop detector (WS2). STUB. Master doc §7, §8.
 * Pure logic: no RN/Expo imports.
 */
import type { DraftEvent, GpsFix } from '@edudriver/shared';

import type { RoadCache, RoadEventDetector, RoadMatch } from '../contracts';

export function createRoadEventDetector(_cache: RoadCache): RoadEventDetector {
  return {
    onGps(_fix: GpsFix, _match: RoadMatch | null): DraftEvent[] {
      // TODO(WS2, §7 speeding): over limit by SPEEDING.coachOverMph for SPEEDING.minDurationS
      //   with accuracy < SPEEDING.maxGpsAccuracyM → coach; harsh (SPEEDING.harshOverMph)
      //   only when match.limitConfidence === 'posted'. Set overMph and peak.
      // TODO(WS2, §8 rolling stops): track min speed while within ROLLING_STOP.signRadiusM of a
      //   stop sign from cache.stopSignsNear (direction-matched when tagged); on exit, if
      //   min > ROLLING_STOP.maxStopSpeedMph emit a coach-tier rolling_stop with minSpeedMph.
      return [];
    },
    reset() {
      // TODO(WS2): clear speeding and stop-sign windows.
    },
  };
}
