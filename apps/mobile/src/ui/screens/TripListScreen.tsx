/**
 * Past drives: Uber-style trip history cards. Each card has a small static
 * route preview (routePreview, Android liteMode), date, distance, duration,
 * score and event count. Tapping a card opens its debrief.
 */
import { DEMO_USER_ID, type TripListItem } from '@edudriver/shared';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApiQuery } from '../../api';
import { Button } from '../components/Button';
import { MapCanvas } from '../components/MapCanvas';
import { Muted } from '../components/primitives';
import { Screen } from '../components/Screen';
import { dateText, durationText, milesText, secondsBetween, totalEvents } from '../lib/format';
import { pointsFromLine } from '../lib/geo';
import type { ScreenProps } from '../navigation';
import { colors, font, radius, shadow, space } from '../theme';

function TripCard({ trip, onPress }: { trip: TripListItem; onPress: () => void }) {
  const route = pointsFromLine(trip.routePreview);
  const events = totalEvents(trip.counts);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
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
    </Pressable>
  );
}

export function TripListScreen({ modules, navigate }: ScreenProps) {
  const { data, error, loading, reload } = useApiQuery('trips', () =>
    modules.api.listTrips(DEMO_USER_ID),
  );

  return (
    <Screen title="Past drives" onBack={() => navigate({ name: 'start' })} backLabel="Home">
      {loading && !data ? <ActivityIndicator color={colors.black} style={styles.loading} /> : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Try again" variant="secondary" onPress={reload} />
        </View>
      ) : null}
      {data?.trips.length === 0 ? (
        <Muted>No drives yet. Your first one will show up here.</Muted>
      ) : null}
      {data?.trips.map((t) => (
        <TripCard
          key={t._id}
          trip={t}
          onPress={() => navigate({ name: 'result', tripId: t._id })}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.xxl },
  errorBox: { gap: space.md, marginVertical: space.lg },
  error: { color: colors.harsh, fontSize: font.body },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: space.lg,
    overflow: 'hidden',
    ...shadow,
  },
  pressed: { opacity: 0.8 },
  preview: { height: 130 },
  body: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md },
  info: { flex: 1 },
  date: { fontSize: font.body, fontWeight: '700', color: colors.text },
  meta: { fontSize: font.small, color: colors.textMuted, marginTop: space.xs },
  score: { alignItems: 'center', minWidth: 56 },
  scoreValue: { fontSize: font.title, fontWeight: '800', color: colors.text },
  scoreLabel: { fontSize: font.tiny, color: colors.textMuted },
});
