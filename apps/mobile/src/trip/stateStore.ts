/**
 * Immutable TripState store with subscribers. Pure. Shared by the real and
 * mock trip sessions so the UI sees identical state transitions from both.
 */
import type { TripState, Unsubscribe } from '../contracts';

export const INITIAL_TRIP_STATE: TripState = Object.freeze({
  status: 'idle',
  tripStartedAt: null,
  options: null,
  events: [],
  latestFix: null,
  latestRoad: null,
  traceLength: 0,
  distanceMi: 0,
  stoppedForS: 0,
  result: null,
  error: null,
});

export interface TripStateStore {
  get(): TripState;
  /** Shallow-merge a patch and notify subscribers with the new object. */
  set(patch: Partial<TripState>): void;
  subscribe(listener: (s: TripState) => void): Unsubscribe;
}

export function createTripStateStore(): TripStateStore {
  let state = INITIAL_TRIP_STATE;
  const listeners = new Set<(s: TripState) => void>();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      for (const l of listeners) l(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
