/**
 * Screen 5 (§12): Progress. Score trend over time, test readiness, per-skill
 * totals and recurring spots on the map. Numbers come from GET /progress.
 * Route lines come from each trip's routePreview (GET /trips). This screen only draws them.
 */
import { DEMO_USER_ID, EVENT_TYPES, type TripListItem } from '@edudriver/shared';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useApiQuery } from '../../api';
import { ConnectionError } from '../components/ConnectionError';
import { MapCanvas } from '../components/MapCanvas';
import { FadeIn, staggerDelay } from '../components/motion';
import { Card, Muted, OsmCredit, SectionTitle } from '../components/primitives';
import { Screen } from '../components/Screen';
import { ScoreTrendChart } from '../components/ScoreTrendChart';
import { EVENT_LABEL } from '../lib/format';
import { pointFromGeo, pointsFromLine, type MapPoint } from '../lib/geo';
import type { ScreenProps } from '../navigation';
import { colors, font, fonts, motion, radius, space } from '../theme';

/** One polyline per trip. A single joined line would draw straight shots between drives. */
function routeLines(trips: TripListItem[]): MapPoint[][] {
  return trips.map((trip) => pointsFromLine(trip.routePreview)).filter((line) => line.length > 1);
}

export function ProgressScreen({ modules, navigate }: ScreenProps) {
  const { data, error, reload } = useApiQuery('progress', () =>
    Promise.all([modules.api.getProgress(DEMO_USER_ID), modules.api.listTrips(DEMO_USER_ID)]).then(
      ([progress, list]) => ({ progress, trips: list.trips }),
    ),
  );
  const routes = useMemo(() => (data ? routeLines(data.trips) : []), [data]);
  const home = () => navigate({ name: 'start' });

  if (!data) {
    return (
      <Screen title="Progress" onBack={home} backLabel="Home">
        {error ? (
          <ConnectionError error={error} onRetry={reload} />
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        )}
      </Screen>
    );
  }

  const { progress } = data;
  const spots = progress.recurringSpots.map((s, i) => ({
    id: String(i),
    ...pointFromGeo(s.location),
    color: colors.harsh,
    title: `${EVENT_LABEL[s.type]} ×${s.count}`,
    description: s.street,
  }));
  const fitTo = [...routes.flat(), ...spots];

  return (
    <Screen title="Progress" onBack={home} backLabel="Home">
      <Card style={styles.readiness}>
        <Text style={styles.readyTitle}>
          {progress.testReadiness.ready ? 'Looking test-ready' : 'Not test-ready yet'}
        </Text>
        {progress.testReadiness.notes.map((n) => (
          <Text key={n} style={styles.note}>
            • {n}
          </Text>
        ))}
      </Card>

      <SectionTitle>Score trend</SectionTitle>
      <ScoreTrendChart trips={progress.qualifyingTrips} />

      <SectionTitle>Skills</SectionTitle>
      {EVENT_TYPES.map((type, i) => {
        const skill = progress.skills[type];
        if (!skill) return null;
        return (
          <FadeIn key={type} delay={staggerDelay(i, motion.slow)} style={styles.skillRow}>
            <Text style={styles.skillName}>{EVENT_LABEL[type]}</Text>
            <Text style={styles.skillValue}>
              {skill.count} total · {skill.per10Mi.toFixed(1)} per 10 mi
            </Text>
          </FadeIn>
        );
      })}

      <SectionTitle>Recurring spots</SectionTitle>
      {spots.length === 0 && routes.length === 0 ? (
        <Muted>No repeat trouble spots. Nice.</Muted>
      ) : (
        <>
          <MapCanvas style={styles.map} routes={routes} pins={spots} fitTo={fitTo} />
          {spots.length === 0 ? (
            <Muted>No repeat trouble spots. Nice.</Muted>
          ) : (
            progress.recurringSpots.map((s, i) => (
              <FadeIn key={`${s.type}-${s.street}-${i}`} delay={staggerDelay(i, motion.fast)}>
                <View style={styles.spot}>
                  <View style={styles.spotCount}>
                    <Text style={styles.spotCountText}>{s.count}</Text>
                  </View>
                  <View style={styles.spotBody}>
                    <Text style={styles.spotTitle}>{EVENT_LABEL[s.type]}</Text>
                    <Text style={styles.spotStreet}>{s.street}</Text>
                  </View>
                  <Text style={styles.spotDrives}>
                    {s.count === 1 ? '1 drive' : `${s.count} drives`}
                  </Text>
                </View>
              </FadeIn>
            ))
          )}
          <OsmCredit />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.xxl },
  readiness: { marginTop: space.md },
  readyTitle: {
    fontSize: font.title,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginBottom: space.sm,
  },
  note: { fontFamily: fonts.regular, fontSize: font.body, color: colors.text, marginTop: space.xs },
  skillRow: {
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  skillName: { fontSize: font.body, fontFamily: fonts.semiBold, color: colors.text },
  skillValue: {
    fontFamily: fonts.regular,
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  map: { height: 220, borderRadius: radius.lg, overflow: 'hidden', marginBottom: space.md },
  spot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  spotCount: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.coral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotCountText: { fontFamily: fonts.semiBold, fontSize: font.body, color: colors.coral700 },
  spotBody: { flex: 1 },
  spotTitle: { fontFamily: fonts.semiBold, fontSize: font.body, color: colors.text },
  spotStreet: {
    fontFamily: fonts.regular,
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  spotDrives: { fontFamily: fonts.semiBold, fontSize: font.small, color: colors.textMuted },
});
