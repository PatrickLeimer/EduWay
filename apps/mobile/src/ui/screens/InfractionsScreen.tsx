/**
 * Infractions: step 2 of the post-trip flow (lib/flow.ts). Every event from the
 * drive, in order, with when and where it happened (street from OSM, §8).
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useApiQuery } from '../../api';
import { ConnectionError } from '../components/ConnectionError';
import { EventRow } from '../components/EventRow';
import { FlowFooter } from '../components/FlowFooter';
import { FadeIn, staggerDelay } from '../components/motion';
import { Card, Muted, OsmCredit, TierDot } from '../components/primitives';
import { Screen } from '../components/Screen';
import { nextRoute, prevRoute } from '../lib/flow';
import { clockText } from '../lib/format';
import { timeEvents } from '../lib/replay';
import type { FlowOrigin, ScreenProps } from '../navigation';
import { colors, font, motion, space } from '../theme';

export function InfractionsScreen({
  modules,
  navigate,
  tripId,
  origin,
}: ScreenProps & { tripId: string; origin: FlowOrigin }) {
  const q = useApiQuery(`trip:${tripId}`, () => modules.api.getTrip(tripId));
  const back = () => navigate(prevRoute('infractions', tripId, origin));
  const footer = (
    <FlowFooter
      step="infractions"
      onPress={() => navigate(nextRoute('infractions', tripId, origin))}
    />
  );

  if (!q.data) {
    return (
      <Screen title="Infractions" onBack={back} backLabel="Replay" footer={footer}>
        {q.error ? (
          <ConnectionError error={q.error} onRetry={q.reload} />
        ) : (
          <ActivityIndicator color={colors.black} style={styles.loading} />
        )}
      </Screen>
    );
  }

  const timed = timeEvents(q.data.events, q.data.trip.startedAt);
  const serious = timed.filter((t) => t.event.tier === 'harsh').length;
  const minor = timed.length - serious;

  return (
    <Screen title="Infractions" onBack={back} backLabel="Replay" footer={footer}>
      <FadeIn fromScale={0.96} fromY={0}>
        <Card style={styles.summary}>
          {timed.length === 0 ? (
            <>
              <Text style={styles.bigNumber}>0</Text>
              <Text style={styles.summaryTitle}>Clean drive</Text>
              <Muted>
                Nothing to flag on this one. That’s exactly what a road test looks like.
              </Muted>
            </>
          ) : (
            <>
              <Text style={styles.bigNumber}>{timed.length}</Text>
              <Text style={styles.summaryTitle}>
                {timed.length === 1 ? 'thing to work on' : 'things to work on'}
              </Text>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <TierDot tier="harsh" />
                  <Text style={styles.legendText}>{serious} serious</Text>
                </View>
                <View style={styles.legendItem}>
                  <TierDot tier="coach" />
                  <Text style={styles.legendText}>{minor} minor</Text>
                </View>
              </View>
            </>
          )}
        </Card>
      </FadeIn>

      {timed.map((t, i) => (
        <FadeIn key={`${t.event.at}-${i}`} delay={staggerDelay(i, motion.normal)} fromY={12}>
          <EventRow event={t.event} time={clockText(t.offsetS)} />
        </FadeIn>
      ))}
      {timed.length > 0 ? (
        <Muted>Times are minutes into the drive. Your coach walks through the big ones next.</Muted>
      ) : null}
      <OsmCredit />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.xxl },
  summary: { alignItems: 'center', gap: space.xs, marginBottom: space.lg, marginTop: space.sm },
  bigNumber: { fontSize: 64, fontWeight: '800', color: colors.text, lineHeight: 72 },
  summaryTitle: { fontSize: font.title, fontWeight: '700', color: colors.text },
  legend: { flexDirection: 'row', gap: space.xl, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legendText: { fontSize: font.body, color: colors.textMuted },
});
