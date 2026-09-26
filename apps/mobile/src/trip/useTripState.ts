/**
 * React binding for a TripSession: re-renders on every state change.
 * Screens use this and the session's methods; they never hold trip logic.
 */
import { useSyncExternalStore } from 'react';

import type { TripSession, TripState } from '../contracts';

export function useTripState(session: TripSession): TripState {
  return useSyncExternalStore(
    (onChange) => session.subscribe(onChange),
    () => session.getState(),
  );
}
