/**
 * Screen 2 (§12): Driving mode. Placeholder: live events as plain text and an
 * End Trip button gated by TripSession.canEnd() (§4: stopped 30+ s).
 * The full-screen lock screen is built in the UI phase.
 */
import { useEffect } from 'react';
import { Button, Text, View } from 'react-native';

import { useTripState } from '../../trip';
import type { ScreenProps } from '../navigation';

export function DrivingScreen({ modules, navigate }: ScreenProps) {
  const trip = modules.trip;
  const state = useTripState(trip);
  const canEnd = trip.canEnd();

  // Leave for the result screen once the upload finishes (or is queued).
  useEffect(() => {
    if (state.status === 'done' || state.status === 'queued' || state.status === 'error') {
      navigate({ name: 'result', tripId: null });
    }
  }, [state.status, navigate]);

  return (
    // Any touch while driving is reported for phone-use detection (§7).
    <View onTouchStart={() => trip.reportTouch()}>
      <Text>Status: {state.status}</Text>
      <Text>Speed: {state.latestFix?.speedMps?.toFixed(1) ?? '-'} m/s</Text>
      <Text>Distance: {state.distanceMi.toFixed(2)} mi</Text>
      <Text>Trace fixes: {state.traceLength}</Text>
      <Text>Stopped for: {state.stoppedForS} s</Text>
      <Button
        title={canEnd.ok ? 'End trip' : `End trip (${canEnd.reason ?? 'not yet'})`}
        disabled={!canEnd.ok}
        onPress={() => void trip.end()}
      />
      <Text>Events ({state.events.length}):</Text>
      <View>
        {state.events.map((e, i) => (
          <Text key={i}>
            {e.type} [{e.tier}] {e.street ?? '?'} {e.speedMph.toFixed(0)} mph
            {e.alerted ? ' (voice alert)' : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}
