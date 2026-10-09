/**
 * Past drives: Uber-style trip history cards. Each card has a small static
 * route preview (routePreview, Android liteMode), date, distance, duration,
 * score and event count. Tapping a card opens its debrief.
 */
import { DEMO_USER_ID, type TripListItem } from '@eduway/shared';
import { StyleSheet, Text, View } from 'react-native';

import { useApiQuery } from '../../api';
import { Button } from '../components/Button';
import { ConnectionError } from '../components/ConnectionError';
import { MapCanvas } from '../components/MapCanvas';
import { FadeIn, PressableScale, staggerDelay } from '../components/motion';
import { Card, Muted } from '../components/primitives';
import { Screen } from '../components/Screen';
import { SkeletonScreen } from '../components/Skeleton';
import { dateText, durationText, milesText, secondsBetween, totalEvents } from '../lib/format';
import { pointsFromLine } from '../lib/geo';
import type { ScreenProps } from '../navigation';
import { colors, edge, font, fonts, motion, radius, space } from '../theme';

function TripCard({ trip, onPress }: { trip: TripListItem; onPress: () => void }) {
  const route = pointsFromLine(trip.routePreview);
  const events = totalEvents(trip.counts);
  const duration = durationText(secondsBetween(trip.startedAt, trip.endedAt));
  const eventsText = events === 0 ? 'no events' : `${events} event${events === 1 ? '' : 's'}`;
  const scoreText =
    trip.score == null
      ? trip.passenger
        ? 'passenger'
        : 'not scored'
      : `score ${Math.round(trip.score)}`;
  return (
    <PressableScale
      accessibilityRole="button"
      // One sentence for screen readers instead of five separate pieces.
      accessibilityLabel={`${dateText(trip.startedAt)}, ${milesText(trip.distanceMi)}, ${duration}, ${eventsText}, ${scoreText}`}
      accessibilityHint="Opens this drive's replay and coaching"
      onPress={onPress}
      pressedScale={0.98}
      style={styles.card}
      contentStyle={styles.cardInner}
    >
      <MapCanvas style={styles.preview} route={route} fitTo={route} interactive={false} lite />
      <View style={styles.body}>
        <View style={styles.info}>
          <Text style={styles.date}>{dateText(trip.startedAt)}</Text>
          <Text style={styles.meta}>
            {milesText(trip.distanceMi)} · {duration} · {eventsText}
          </Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreValue} maxFontSizeMultiplier={1.3}>
            {trip.score == null ? '--' : Math.round(trip.score)}
          </Text>
          <Text style={styles.scoreLabel}>{trip.passenger ? 'passenger' : 'score'}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

export function TripListScreen({ modules, navigate }: ScreenProps) {
  const { data, error, loading, reload } = useApiQuery('trips', () =>
    modules.api.listTrips(DEMO_USER_ID),
  );

  return (
    <Screen
      title="Past drives"
      onBack={() => navigate({ name: 'start' })}
      backLabel="Home"
      onRefresh={reload}
      refreshing={loading && data !== null}
    >
      {loading && !data && !error ? <SkeletonScreen variant="trips" /> : null}
      {error ? <ConnectionError error={error} onRetry={reload} /> : null}
      {data?.trips.length === 0 ? (
        // Empty state with the next step, not a dead end.
        <FadeIn fromScale={0.96} fromY={0}>
          <Card lip style={styles.empty}>
            <Text style={styles.emptyTitle}>No drives yet</Text>
            <Muted>
              Your drives show up here with a replay, your score and your coach’s notes.
            </Muted>
            <Button
              title="Start a drive"
              onPress={() => navigate({ name: 'start' })}
              style={styles.emptyButton}
            />
          </Card>
        </FadeIn>
      ) : null}
      {/* Cards glide up one after another. */}
      {data?.trips.map((t, i) => (
        <FadeIn key={t._id} delay={staggerDelay(i, motion.fast)} fromY={28}>
          <TripCard trip={t} onPress={() => navigate({ name: 'ended', tripId: t._id })} />
        </FadeIn>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: space.xl, gap: space.xs },
  emptyTitle: { fontSize: font.title, fontFamily: fonts.semiBold, color: colors.text },
  emptyButton: { alignSelf: 'stretch', marginTop: space.lg },
  // Edge on the outer view, clipping on the inner one.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: space.lg,
    ...edge,
  },
  cardInner: { borderRadius: radius.lg, overflow: 'hidden' },
  preview: { height: 130 },
  body: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md },
  info: { flex: 1 },
  date: { fontSize: font.body, fontFamily: fonts.semiBold, color: colors.text },
  meta: {
    fontFamily: fonts.regular,
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: space.xs,
  },
  score: { alignItems: 'center', minWidth: 56 },
  scoreValue: { fontSize: font.title, fontFamily: fonts.semiBold, color: colors.text },
  scoreLabel: { fontFamily: fonts.regular, fontSize: font.tiny, color: colors.textMuted },
});
