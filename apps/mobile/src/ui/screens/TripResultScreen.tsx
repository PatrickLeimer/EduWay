/**
 * Screen 3 (§12): Trip debrief, laid out like an Uber trip receipt: route map,
 * score, voice debrief playback, strengths, focus areas, event breakdown.
 * tripId null → the trip that just ended (TripSession state); otherwise loads
 * the trip from the API.
 */
import type { RecordedEvent } from '@edudriver/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useApiQuery } from '../../api';
import { useTripState } from '../../trip';
import { Button } from '../components/Button';
import { ConnectionError } from '../components/ConnectionError';
import { EventRow } from '../components/EventRow';
import { MapCanvas } from '../components/MapCanvas';
import { FadeIn, staggerDelay } from '../components/motion';
import { Card, Muted, OsmCredit, SectionTitle, StatTile } from '../components/primitives';
import { Screen } from '../components/Screen';
import { ScoreRing } from '../components/ScoreRing';
import { dateText, durationText, milesText, secondsBetween } from '../lib/format';
import { pointFromGeo, pointsFromLine } from '../lib/geo';
import type { ScreenProps } from '../navigation';
import { colors, font, motion, space } from '../theme';

export function TripResultScreen({
  modules,
  navigate,
  tripId,
}: ScreenProps & { tripId: string | null }) {
  const state = useTripState(modules.trip);
  const loaded = useApiQuery(`trip:${tripId ?? 'current'}`, () =>
    tripId ? modules.api.getTrip(tripId) : Promise.resolve(null),
  );
  const [playing, setPlaying] = useState(false);

  const trip = tripId ? loaded.data?.trip : state.result?.trip;
  const events: RecordedEvent[] = tripId ? (loaded.data?.events ?? []) : state.events;

  // Stop the debrief when leaving the screen.
  const debrief = modules.debrief;
  useEffect(() => () => debrief.stop(), [debrief]);

  const back = () => {
    if (!tripId) modules.trip.reset();
    navigate({ name: tripId ? 'list' : 'start' });
  };

  if (!trip) {
    return (
      <Screen title="Feedback" onBack={back}>
        {loaded.error ? (
          <ConnectionError error={loaded.error} onRetry={loaded.reload} />
        ) : (
          <ActivityIndicator color={colors.black} style={styles.loading} />
        )}
      </Screen>
    );
  }

  const route = pointsFromLine(trip.routePreview);
  const pins = events.map((e, i) => ({
    id: String(i),
    ...pointFromGeo(e.location),
    color: e.tier === 'harsh' ? colors.harsh : colors.coach,
  }));
  const audioUrl = trip.coachAudioUrl;
  const coach = trip.coach;

  const togglePlay = async () => {
    if (!audioUrl) return;
    if (playing) {
      debrief.stop();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    try {
      await debrief.play(audioUrl);
    } finally {
      setPlaying(false);
    }
  };

  return (
    <Screen
      title="Feedback"
      onBack={back}
      backLabel={tripId ? 'Past drives' : 'Home'}
      hero={<MapCanvas style={styles.map} route={route} fitTo={route} pins={pins} />}
      footer={
        <Button
          title="Watch replay"
          large
          onPress={() => navigate({ name: 'replay', tripId: trip._id })}
        />
      }
    >
      <Muted>{dateText(trip.startedAt)}</Muted>

      <View style={styles.scoreRow}>
        {/* Score pops in first; it's the headline of the receipt. */}
        <FadeIn delay={motion.normal} fromY={0} fromScale={0.8} duration={motion.slow}>
          <ScoreRing score={trip.score} />
        </FadeIn>
        <View style={styles.scoreSide}>
          <StatTile label="Distance" value={milesText(trip.distanceMi)} />
          <StatTile
            label="Time"
            value={durationText(secondsBetween(trip.startedAt, trip.endedAt))}
          />
        </View>
      </View>
      {trip.passenger ? <Muted>Passenger trip: recorded but not scored.</Muted> : null}

      {audioUrl ? (
        <Button
          title={playing ? 'Stop voice debrief' : 'Play voice debrief'}
          variant="secondary"
          onPress={() => void togglePlay()}
          style={styles.play}
        />
      ) : null}

      {coach ? (
        <>
          {coach.strengths.length > 0 ? (
            <>
              <SectionTitle>What went well</SectionTitle>
              {coach.strengths.map((s, i) => (
                <FadeIn key={s} delay={staggerDelay(i, motion.slow)} fromX={-12} fromY={0}>
                  <Text style={styles.bullet}>✓ {s}</Text>
                </FadeIn>
              ))}
            </>
          ) : null}
          {coach.focus_areas.length > 0 ? (
            <>
              <SectionTitle>Focus next time</SectionTitle>
              {coach.focus_areas.map((f, i) => (
                <FadeIn key={f.skill} delay={staggerDelay(i + 2, motion.slow)} fromY={20}>
                  <Card style={styles.focus}>
                    <Text style={styles.focusSkill}>{f.skill}</Text>
                    <Text style={styles.focusWhy}>{f.why}</Text>
                    <Text style={styles.focusTip}>Tip: {f.tip}</Text>
                  </Card>
                </FadeIn>
              ))}
            </>
          ) : null}
        </>
      ) : (
        <Muted>No coaching for this trip.</Muted>
      )}

      <SectionTitle>Events ({events.length})</SectionTitle>
      {events.length === 0 ? <Muted>Clean drive: no events recorded.</Muted> : null}
      {events.map((e, i) => (
        <FadeIn key={i} delay={staggerDelay(i, motion.slow)} fromY={10}>
          <EventRow event={e} />
        </FadeIn>
      ))}
      <OsmCredit />
      <Muted>Scores are a coaching tool, not a certification of safety.</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 240 },
  loading: { marginTop: space.xxl },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.lg },
  scoreSide: { flex: 1, gap: space.sm },
  play: { marginTop: space.lg },
  bullet: { fontSize: font.body, color: colors.text, marginBottom: space.sm },
  focus: { marginBottom: space.md },
  focusSkill: { fontSize: font.body, fontWeight: '700', color: colors.text },
  focusWhy: { fontSize: font.body, color: colors.text, marginTop: space.xs },
  focusTip: { fontSize: font.body, color: colors.textMuted, marginTop: space.sm },
});
