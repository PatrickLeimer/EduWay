/**
 * After End drive: shows the recorded route while the trip uploads, then a
 * "Get feedback" button that opens the debrief. The voice debrief itself starts
 * automatically when coaching arrives (§4; TripSession plays it), so this
 * button only opens the written debrief, score and replay.
 */
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTripState } from '../../trip';
import { Button } from '../components/Button';
import { MapCanvas } from '../components/MapCanvas';
import { FadeIn } from '../components/motion';
import { Muted, StatTile } from '../components/primitives';
import { Screen } from '../components/Screen';
import { durationText, milesText, secondsBetween } from '../lib/format';
import { pointsFromTrace } from '../lib/geo';
import type { ScreenProps } from '../navigation';
import { colors, font, radius, space } from '../theme';

export function TripEndedScreen({ modules, navigate }: ScreenProps) {
  const trip = modules.trip;
  const state = useTripState(trip);
  // The trace stops growing once the trip has ended, so read it once.
  const route = useMemo(() => pointsFromTrace(trip.getTrace()), [trip]);

  const goHome = () => {
    trip.reset();
    navigate({ name: 'start' });
  };

  const timeText = state.result
    ? durationText(secondsBetween(state.result.trip.startedAt, state.result.trip.endedAt))
    : '…';

  let footer;
  let status;
  switch (state.status) {
    case 'done':
      status = (
        <Text style={styles.statusText}>
          {state.result?.coachAudioUrl ? 'Your coach is talking you through it.' : 'Drive saved.'}
        </Text>
      );
      footer = (
        <Button
          title="Get feedback"
          large
          onPress={() => navigate({ name: 'result', tripId: null })}
        />
      );
      break;
    case 'queued':
      status = (
        <Text style={styles.statusText}>
          No connection. Your drive is saved on this phone and will upload automatically.
        </Text>
      );
      footer = <Button title="Back to home" large onPress={goHome} />;
      break;
    case 'error':
      status = (
        <Text style={[styles.statusText, styles.error]}>{state.error ?? 'Upload failed'}</Text>
      );
      footer = <Button title="Back to home" large onPress={goHome} />;
      break;
    default:
      status = (
        <View style={styles.row}>
          <ActivityIndicator color={colors.black} />
          <Text style={styles.statusText}>Saving your drive and preparing feedback…</Text>
        </View>
      );
  }

  return (
    <Screen
      title="Drive complete"
      hero={
        <MapCanvas
          style={styles.map}
          route={route}
          fitTo={route}
          car={route[route.length - 1] ?? null}
        />
      }
      footer={footer}
    >
      {/* Keyed by status so each step (saving → done) animates in. */}
      <FadeIn key={state.status} style={styles.status} fromY={10}>
        {status}
      </FadeIn>
      <View style={styles.tiles}>
        <StatTile label="Distance" value={milesText(state.distanceMi)} />
        <StatTile label="Time" value={timeText} />
      </View>
      {state.options?.passenger ? <Muted>Passenger trip: recorded but not scored.</Muted> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 260 },
  status: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: space.lg,
    marginTop: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusText: { flexShrink: 1, fontSize: font.body, color: colors.text },
  error: { color: colors.harsh },
  tiles: { flexDirection: 'row', gap: space.sm, marginTop: space.md, marginBottom: space.sm },
});
