/**
 * Driving growth: step 3 of the post-trip flow (lib/flow.ts). A placeholder
 * for the future game-style progress (levels, streaks, badges). Nothing here
 * is computed yet: no invented numbers or thresholds (docs/ui-prompt.md §1),
 * so everything is shown locked and labeled "Coming soon".
 */
import { StyleSheet, Text, View } from 'react-native';

import { FlowFooter } from '../components/FlowFooter';
import { FadeIn, staggerDelay } from '../components/motion';
import { Card, Muted } from '../components/primitives';
import { Screen } from '../components/Screen';
import { nextRoute, prevRoute } from '../lib/flow';
import type { FlowOrigin, ScreenProps } from '../navigation';
import { colors, font, motion, radius, space } from '../theme';

/** Ideas for the future game; names only. */
const BADGES = [
  { name: 'Smooth Stopper', hint: 'Full stops, soft brakes' },
  { name: 'Phone-Free Streak', hint: 'Drives without touching the phone' },
  { name: 'Speed Keeper', hint: 'Holding the posted limit' },
  { name: 'Road Test Ready', hint: 'Consistent, clean drives' },
];

export function GrowthScreen({
  navigate,
  tripId,
  origin,
}: ScreenProps & { tripId: string; origin: FlowOrigin }) {
  return (
    <Screen
      title="Driving growth"
      onBack={() => navigate(prevRoute('growth', tripId, origin))}
      backLabel="Infractions"
      footer={
        <FlowFooter step="growth" onPress={() => navigate(nextRoute('growth', tripId, origin))} />
      }
    >
      <FadeIn fromScale={0.96} fromY={0}>
        <View style={styles.hero}>
          <Text style={styles.soon}>COMING SOON</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>?</Text>
          </View>
          <Text style={styles.heroTitle}>Your driving journey</Text>
          <Text style={styles.heroSub}>
            Level up with every drive. Earn badges, keep streaks going, and watch yourself get road
            test ready.
          </Text>
          <View style={styles.track}>
            <View style={styles.trackFill} />
          </View>
        </View>
      </FadeIn>

      <Text style={styles.section}>Badges to unlock</Text>
      <View style={styles.grid}>
        {BADGES.map((b, i) => (
          <FadeIn key={b.name} delay={staggerDelay(i, motion.normal)} style={styles.cell}>
            <Card style={styles.badge}>
              <View style={styles.lock}>
                <View style={styles.lockShackle} />
                <View style={styles.lockBody} />
              </View>
              <Text style={styles.badgeName}>{b.name}</Text>
              <Muted>{b.hint}</Muted>
            </Card>
          </FadeIn>
        ))}
      </View>
      <Muted>Your coach is up next.</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.route,
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  soon: { fontSize: font.small, fontWeight: '800', letterSpacing: 2, color: colors.white },
  levelBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space.sm,
  },
  levelText: { fontSize: 40, fontWeight: '800', color: colors.white },
  heroTitle: { fontSize: font.title, fontWeight: '800', color: colors.white },
  heroSub: { fontSize: font.body, color: colors.white, textAlign: 'center', opacity: 0.9 },
  track: {
    alignSelf: 'stretch',
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: space.md,
    overflow: 'hidden',
  },
  trackFill: { width: '8%', height: '100%', backgroundColor: colors.white },
  section: {
    fontSize: font.title,
    fontWeight: '700',
    color: colors.text,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  cell: { width: '48.5%' },
  badge: { gap: space.xs, opacity: 0.75 },
  lock: { alignItems: 'center', alignSelf: 'flex-start', marginBottom: space.xs },
  lockShackle: {
    width: 14,
    height: 10,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 2.5,
    borderBottomWidth: 0,
    borderColor: colors.textMuted,
  },
  lockBody: { width: 20, height: 14, borderRadius: 3, backgroundColor: colors.textMuted },
  badgeName: { fontSize: font.body, fontWeight: '700', color: colors.text },
});
