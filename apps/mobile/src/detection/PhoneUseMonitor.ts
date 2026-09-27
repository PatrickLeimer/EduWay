/**
 * Real PhoneUseMonitor (WS1). Master doc §7 "Phone use detection", §18 flag 2.
 *
 * Thin wrapper over React Native `AppState`; the rules live in phoneUse.ts.
 */
import type { DraftEvent, GpsFix } from '@edudriver/shared';
import { AppState } from 'react-native';

import type { PhoneUseMonitor } from '../contracts';

import { createEmitter } from './emitter';
import { createPhoneUseTracker, type PhoneUseTracker } from './phoneUse';

export function createPhoneUseMonitor(): PhoneUseMonitor {
  const events = createEmitter<DraftEvent>();
  let tracker: PhoneUseTracker | null = null;
  let subscription: { remove(): void } | null = null;

  const emit = (e: DraftEvent | null) => {
    if (e) events.emit(e);
  };

  return {
    start(opts: { lockEnabled: boolean; getLatestFix: () => GpsFix | null }) {
      subscription?.remove();
      tracker = createPhoneUseTracker(opts);
      subscription = AppState.addEventListener('change', (state) => {
        emit(tracker?.onAppState(state, Date.now()) ?? null);
      });
    },
    stop() {
      subscription?.remove();
      subscription = null;
      emit(tracker?.close(Date.now()) ?? null);
      tracker = null;
    },
    reportTouch() {
      emit(tracker?.onTouch(Date.now()) ?? null);
    },
    reportSafeExit() {
      tracker?.onSafeExit();
    },
    subscribe: (listener) => events.subscribe(listener),
  };
}
