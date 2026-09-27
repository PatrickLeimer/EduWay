/**
 * Driving growth: step 3 of the post-trip flow (lib/flow.ts). Rank tier,
 * streaks and road test readiness from GET /progress, plus what this drive
 * changed (the upload's progressUpdate) when the flow started from a trip.
 * The server computes every number; this screen only draws them.
 */
import { DEMO_USER_ID, GAMIFICATION, STREAK_KINDS, type ProgressUpdate } from '@edudriver/shared';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useApiQuery } from '../../api';
import { useTripState } from '../../trip';
import { BadgeGrid } from '../components/BadgeGrid';
import { ConnectionError } from '../components/ConnectionError';
import { FlowFooter } from '../components/FlowFooter';
import { FadeIn } from '../components/motion';
import { Card, Muted, SectionTitle } from '../components/primitives';
import { Screen } from '../components/Screen';
import { ScoreTrendChart } from '../components/ScoreTrendChart';
import { nextRoute, prevRoute } from '../lib/flow';
import {
  readinessChangeText,
  STREAK_RULE,
  STREAK_TITLE,
  streakChangeText,
  tierChangeText,
  tierLine,
  tierProgressText,
} from '../lib/gamificationCopy';
import type { FlowOrigin, ScreenProps } from '../navigation';
import { colors, font, fonts, lip, radius, space } from '../theme';

/** One line per thing this drive changed; empty when nothing did. */
function changeLines(u: ProgressUpdate): string[] {
  const lines = [tierChangeText(u.tier)];
  for (const kind of STREAK_KINDS) lines.push(streakChangeText(kind, u.streaks[kind]));
  lines.push(readinessChangeText(u.readiness));
  return lines.filter((l): l is string => l !== null);
}

export function GrowthScreen({
  modules,
  navigate,
  tripId,
  origin,
}: ScreenProps & { tripId: string; origin: FlowOrigin }) {
  const { data, error, reload } = useApiQuery('progress', () =>
    modules.api.getProgress(DEMO_USER_ID),
  );
  const tripState = useTripState(modules.trip);
  // Only the drive that just ended carries a progressUpdate; past drives don't.
  const update =
    origin === 'trip' && tripState.result?.trip._id === tripId
      ? tripState.result.progressUpdate
      : undefined;

  const footer = (
    <FlowFooter step="growth" onPress={() => navigate(nextRoute('growth', tripId, origin))} />
  );
  const back = () => navigate(prevRoute('growth', tripId, origin));

  if (!data) {
    return (
      <Screen title="Driving growth" onBack={back} backLabel="Infractions" footer={footer}>
        {error ? (
          <ConnectionError error={error} onRetry={reload} />
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        )}
      </Screen>
    );
  }

  const p = data.userProgress;
  const lines = update ? changeLines(update) : [];

  return (
    <Screen title="Driving growth" onBack={back} backLabel="Infractions" footer={footer}>
      <FadeIn fromScale={0.96} fromY={0}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>RANK</Text>
          <Text style={styles.heroTitle}>{tierLine(p.tier)}</Text>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${Math.round(p.tierProgress * 100)}%` }]} />
          </View>
          <Text style={styles.heroSub}>{tierProgressText(p)}</Text>
        </View>
      </FadeIn>

      <SectionTitle>Score trend</SectionTitle>
      <ScoreTrendChart trips={data.qualifyingTrips} />

      {update ? (
        <>
          <SectionTitle>This drive</SectionTitle>
          {update.qualifying ? (
            <Card lip style={styles.changes}>
              {lines.map((l) => (
                <Text key={l} style={styles.changeLine}>
                  {l}
                </Text>
              ))}
            </Card>
          ) : (
            <Muted>{"Passenger and very short drives don't change your rank or streaks."}</Muted>
          )}
        </>
      ) : null}

      <SectionTitle>Road test readiness</SectionTitle>
      <View style={styles.readyRow}>
        <Text style={styles.readyNumber}>{p.readiness}%</Text>
        <Muted>
          {p.readinessProvisional
            ? `Based on ${p.qualifyingTrips} scored ${p.qualifyingTrips === 1 ? 'drive' : 'drives'} so far`
            : `Based on your last ${GAMIFICATION.readinessWindow} scored drives`}
        </Muted>
      </View>

      <SectionTitle>Streaks</SectionTitle>
      {p.qualifyingTrips === 0 ? (
        <Muted>Your first scored drive starts your streaks.</Muted>
      ) : (
        STREAK_KINDS.map((kind) => {
          const s = p.streaks[kind];
          return (
            <View key={kind} style={styles.streakRow}>
              <View style={styles.streakText}>
                <Text style={styles.streakTitle}>{STREAK_TITLE[kind]}</Text>
                <Muted>
                  {STREAK_RULE[kind]} · best {s.best}
                </Muted>
              </View>
              <Text style={[styles.streakCount, s.current > 0 && styles.streakOn]}>
                {s.current}
              </Text>
            </View>
          );
        })
      )}

      <SectionTitle>Badges</SectionTitle>
      <BadgeGrid progress={p} />

      <Muted>Your coach is up next.</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.xxl },
  hero: {
    backgroundColor: colors.primary,
    borderBottomWidth: lip.rest,
    borderBottomColor: colors.primaryLip,
    borderRadius: radius.xl,
    padding: space.xl,
    gap: space.sm,
    marginTop: space.sm,
  },
  heroLabel: {
    fontSize: font.small,
    fontFamily: fonts.semiBold,
    letterSpacing: 2,
    color: colors.onColor,
  },
  heroTitle: { fontSize: font.display, fontFamily: fonts.semiBold, color: colors.onColor },
  heroSub: { fontFamily: fonts.regular, fontSize: font.body, color: colors.onColor },
  track: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLip,
    marginTop: space.sm,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.onColor },
  changes: { gap: space.sm },
  changeLine: { fontFamily: fonts.regular, fontSize: font.body, color: colors.text },
  readyRow: { gap: space.xs },
  readyNumber: { fontSize: 56, lineHeight: 64, fontFamily: fonts.semiBold, color: colors.text },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  streakText: { flex: 1, paddingRight: space.md },
  streakTitle: { fontSize: font.body, fontFamily: fonts.semiBold, color: colors.text },
  streakCount: { fontSize: font.title, fontFamily: fonts.semiBold, color: colors.textMuted },
  streakOn: { color: colors.harsh },
});
