/**
 * Phone use rules (§7 "Phone use detection", §18 flag 2). Pure, no RN/Expo
 * imports; PhoneUseMonitor.ts feeds it AppState changes and touches.
 *
 * - Only counts while moving faster than PHONE_USE.minSpeedMps.
 * - Touches (lock on: the lock screen only reports non-emergency/navigation
 *   touches; lock off: any in-app touch) emit immediately so the warning plays
 *   right away. Further touches within PIPELINE.mergeWindowS of the last one
 *   are the same episode and are not emitted again (§7 step 4 merge).
 * - Lock off only: the app going to the background while moving opens an
 *   episode; it is emitted when the app is active again, with durationS = time
 *   away (the warning plays on return, §18 flag 2). Location and speed are
 *   from when the student left.
 * - Navigation and emergency calls always stay available (§4): after
 *   onSafeExit, the next trip to the background is not phone use. The excuse
 *   is used up by that trip, or dropped at the next in-app touch (the link
 *   did not open).
 */
import { MPS_TO_MPH, PHONE_USE, PIPELINE, type DraftEvent, type GpsFix } from '@edudriver/shared';

/** React Native's AppStateStatus, without importing react-native. */
export type AppStateLike = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

export interface PhoneUseTracker {
  onAppState(state: AppStateLike, t: number): DraftEvent | null;
  onTouch(t: number): DraftEvent | null;
  /** The app is opening navigation or an emergency call. */
  onSafeExit(): void;
  /** Trip end: emits any episode still open. */
  close(t: number): DraftEvent | null;
}

const isMoving = (fix: GpsFix | null): fix is GpsFix =>
  fix !== null && fix.speedMps !== null && fix.speedMps > PHONE_USE.minSpeedMps;

function toEvent(fix: GpsFix, startT: number, endT: number): DraftEvent {
  return {
    type: 'phone_use',
    tier: 'harsh',
    peak: null,
    durationS: (endT - startT) / 1000,
    speedMph: (fix.speedMps ?? 0) * MPS_TO_MPH,
    at: new Date(startT).toISOString(),
    location: { type: 'Point', coordinates: [fix.lon, fix.lat] },
  };
}

export function createPhoneUseTracker(opts: {
  lockEnabled: boolean;
  getLatestFix: () => GpsFix | null;
}): PhoneUseTracker {
  let away: { startT: number; fix: GpsFix } | null = null;
  /** Last touch, or return from the background; later touches within the merge window join it. */
  let lastUseT: number | null = null;
  let safeExit = false;

  function endAway(t: number): DraftEvent | null {
    if (!away) return null;
    const e = toEvent(away.fix, away.startT, t);
    away = null;
    lastUseT = t;
    return e;
  }

  return {
    onAppState(state, t) {
      if (state === 'active') return endAway(t);
      if (state !== 'background' || opts.lockEnabled || away) return null;
      if (safeExit) {
        safeExit = false;
        return null;
      }
      const fix = opts.getLatestFix();
      if (isMoving(fix)) away = { startT: t, fix };
      return null;
    },
    onTouch(t) {
      safeExit = false;
      const fix = opts.getLatestFix();
      if (!isMoving(fix)) return null;
      const merged = lastUseT !== null && t - lastUseT < PIPELINE.mergeWindowS * 1000;
      lastUseT = t;
      return merged ? null : toEvent(fix, t, t);
    },
    onSafeExit() {
      safeExit = true;
    },
    close: endAway,
  };
}
