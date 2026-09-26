/**
 * GPS for the WS2 debug map. While a trip is recording, this is the trip fix.
 * Before and after that, a foreground watch so the map can show the phone's
 * location (a finished trip keeps its last fix until reset()).
 */
import { useEffect, useState } from 'react';

import type { GpsFix } from '@edudriver/shared';

import type { TripSession } from '../contracts';
import { createExpoLocationSource } from './locationSource';
import { useTripState } from './useTripState';

export function useMapGps(session: TripSession): { fix: GpsFix | null; error: string | null } {
  const state = useTripState(session);
  const [preview, setPreview] = useState<GpsFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tripFix = state.latestFix;

  const recording = state.status === 'starting' || state.status === 'driving';
  const followTrip = recording && tripFix != null;

  useEffect(() => {
    if (followTrip) return;
    const source = createExpoLocationSource();
    let alive = true;
    source
      .start((fix) => {
        if (!alive) return;
        setPreview(fix);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Location unavailable');
      });
    return () => {
      alive = false;
      source.stop();
      // Drop the pre-trip fix so the map doesn't jump back to it after the trip.
      setPreview(null);
    };
  }, [followTrip]);

  return { fix: followTrip ? tripFix : (preview ?? tripFix), error };
}
