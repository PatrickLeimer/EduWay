/**
 * Past drives: Uber-style trip history cards. Each card has a small static
 * route preview (routePreview, Android liteMode), date, distance, duration,
 * score and event count. Tapping a card opens its debrief.
 */
import { DEMO_USER_ID, type TripListItem } from '@edudriver/shared';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useApiQuery } from '../../api';
import { ConnectionError } from '../components/ConnectionError';
import { MapCanvas } from '../components/MapCanvas';
import { FadeIn, PressableScale, staggerDelay } from '../components/motion';
import { Muted } from '../components/primitives';
import { Screen } from '../components/Screen';
import { dateText, durationText, milesText, secondsBetween, totalEvents } from '../lib/format';
import { pointsFromLine } from '../lib/geo';
import type { ScreenProps } from '../navigation';
import { colors, edge, font, motion, radius, space } from '../theme';

function TripCard({ trip, onPress }: { trip: TripListItem; onPress: () => void }) {
  const route = pointsFromLine(trip.routePreview);
  const events = totalEvents(trip.counts);
  return (
    <PressableScale
      accessibilityRole="button"
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
            {milesText(trip.distanceMi)} ·{' '}
            {durationText(secondsBetween(trip.startedAt, trip.endedAt))} ·{' '}
            {events === 0 ? 'no events' : `${events} event${events === 1 ? '' : 's'}`}
          </Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreValue}>
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
    <Screen title="Past drives" onBack={() => navigate({ name: 'start' })} backLabel="Home">
      {loading && !data ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : null}
      {error ? <ConnectionError error={error} onRetry={reload} /> : null}
      {data?.trips.length === 0 ? (
        <Muted>No drives yet. Your first one will show up here.</Muted>
      ) : null}
      {/* Cards glide up one after another. */}
      {data?.trips.map((t, i) => (
        <FadeIn key={t._id} delay={staggerDelay(i, motion.fast)} fromY={28}>
          <TripCard
            trip={t}
            onPress={() => navigate({ name: 'replay', tripId: t._id, origin: 'history' })}
          />
        </FadeIn>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.xxl },
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
  date: { fontSize: font.body, fontWeight: '700', color: colors.text },
  meta: { fontSize: font.small, color: colors.textMuted, marginTop: space.xs },
  score: { alignItems: 'center', minWidth: 56 },
  scoreValue: { fontSize: font.title, fontWeight: '800', color: colors.text },
  scoreLabel: { fontSize: font.tiny, color: colors.textMuted },
});
