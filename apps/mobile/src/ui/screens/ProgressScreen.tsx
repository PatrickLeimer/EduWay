/**
 * Screen 5 (§12): Progress. Score trend (simple bars, no chart library), test
 * readiness, per-skill totals and recurring spots on the map. All numbers come
 * from GET /progress; this screen only draws them.
 */
import { DEMO_USER_ID, EVENT_TYPES } from '@edudriver/shared';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useApiQuery } from '../../api';
import { ConnectionError } from '../components/ConnectionError';
import { MapCanvas } from '../components/MapCanvas';
import { FadeIn, GrowBar, staggerDelay } from '../components/motion';
import { Card, Muted, OsmCredit, SectionTitle } from '../components/primitives';
import { Screen } from '../components/Screen';
import { EVENT_LABEL } from '../lib/format';
import { pointFromGeo } from '../lib/geo';
import type { ScreenProps } from '../navigation';
import { colors, font, motion, radius, space } from '../theme';

export function ProgressScreen({ modules, navigate }: ScreenProps) {
  const { data, error, reload } = useApiQuery('progress', () =>
    modules.api.getProgress(DEMO_USER_ID),
  );
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

  const scored = data.scores.filter((s) => s.score != null);
  const spots = data.recurringSpots.map((s, i) => ({
    id: String(i),
    ...pointFromGeo(s.location),
    color: colors.harsh,
    title: `${EVENT_LABEL[s.type]} ×${s.count}`,
    description: s.street,
  }));

  return (
    <Screen title="Progress" onBack={home} backLabel="Home">
      <Card style={styles.readiness}>
        <Text style={styles.readyTitle}>
          {data.testReadiness.ready ? 'Looking test-ready' : 'Not test-ready yet'}
        </Text>
        {data.testReadiness.notes.map((n) => (
          <Text key={n} style={styles.note}>
            • {n}
          </Text>
        ))}
      </Card>

      <SectionTitle>Score trend</SectionTitle>
      {scored.length === 0 ? (
        <Muted>Scores show up after your first scored drive.</Muted>
      ) : (
        <View style={styles.chart}>
          {scored.map((s, i) => (
            <View key={s.tripId} style={styles.col}>
              <Text style={styles.colValue}>{Math.round(s.score ?? 0)}</Text>
              <GrowBar
                delay={staggerDelay(i, motion.normal)}
                style={[styles.colBar, { height: `${Math.max(4, s.score ?? 0)}%` }]}
              />
            </View>
          ))}
        </View>
      )}

      <SectionTitle>Skills</SectionTitle>
      {EVENT_TYPES.map((type, i) => {
        const skill = data.skills[type];
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
      {spots.length === 0 ? (
        <Muted>No repeat trouble spots. Nice.</Muted>
      ) : (
        <>
          <MapCanvas style={styles.map} pins={spots} fitTo={spots} />
          {data.recurringSpots.map((s, i) => (
            <Text key={i} style={styles.spot}>
              {EVENT_LABEL[s.type]} on {s.street} · {s.count} drives
            </Text>
          ))}
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
    fontWeight: '700',
    color: colors.text,
    marginBottom: space.sm,
  },
  note: { fontSize: font.body, color: colors.text, marginTop: space.xs },
  chart: {
    height: 160,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: space.md,
  },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  colValue: { fontSize: font.tiny, color: colors.textMuted, marginBottom: 2 },
  colBar: { width: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  skillRow: {
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  skillName: { fontSize: font.body, fontWeight: '600', color: colors.text },
  skillValue: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  map: { height: 220, borderRadius: radius.lg, overflow: 'hidden', marginBottom: space.md },
  spot: { fontSize: font.body, color: colors.text, marginBottom: space.xs },
});
