/**
 * Real PhoneUseMonitor (WS1). STUB. Master doc §7 "Phone use detection", §18 flag 2.
 *
 * Will use React Native `AppState`; keep any pure decision logic (is this
 * phone use? how long?) in a separate pure file so it can be unit tested.
 */
import type { DraftEvent, GpsFix } from '@edudriver/shared';

import type { PhoneUseMonitor } from '../contracts';

import { createEmitter } from './emitter';

export function createPhoneUseMonitor(): PhoneUseMonitor {
  const events = createEmitter<DraftEvent>();

  return {
    start(_opts: { lockEnabled: boolean; getLatestFix: () => GpsFix | null }) {
      // TODO(WS1): keep opts (lockEnabled decides touch vs AppState rules; getLatestFix gives speed).
      // TODO(WS1): AppState.addEventListener('change'): background while moving
      //   (speed > PHONE_USE.minSpeedMps) starts an episode; returning to active ends it
      //   and emits one phone_use event with durationS = time away.
    },
    stop() {
      // TODO(WS1): remove the AppState listener; close any open episode.
    },
    reportTouch() {
      // TODO(WS1): if moving, emit (or extend) a phone_use episode. With the lock on,
      //   the lock screen only calls this for non-emergency/navigation touches.
    },
    subscribe: (listener) => events.subscribe(listener),
  };
}
