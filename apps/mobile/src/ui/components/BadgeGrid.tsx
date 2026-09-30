/**
 * Badges on the Driving growth screen: two columns, earned ones filled teal and
 * locked ones showing what it takes. Which badges exist and whether they are
 * earned is decided in lib/badges.ts, straight off GAMIFICATION constants.
 */
import type { UserProgress } from '@eduway/shared';
import { StyleSheet, Text, View } from 'react-native';

import { earnedBadges } from '../lib/badges';
import { colors, font, fonts, lip, motion, radius, space, stroke } from '../theme';
import { FadeIn, staggerDelay } from './motion';

/** Drawn with Views, like the other glyphs in the app (there is no icon set). */
function LockGlyph() {
  return (
    <View style={styles.glyph}>
      <View style={styles.lockShackle} />
      <View style={styles.lockBody} />
    </View>
  );
}

function CheckGlyph() {
  return (
    <View style={styles.glyph}>
      <View style={styles.check} />
    </View>
  );
}

export function BadgeGrid({ progress }: { progress: UserProgress }) {
  return (
    <View style={styles.grid}>
      {earnedBadges(progress).map((badge, i) => (
        <FadeIn key={badge.id} delay={staggerDelay(i, motion.normal)} style={styles.cell}>
          <View
            style={[styles.badge, badge.earned ? styles.earned : styles.locked]}
            accessibilityLabel={`${badge.name}, ${badge.earned ? 'earned' : 'locked'}. ${badge.hint}`}
          >
            {badge.earned ? <CheckGlyph /> : <LockGlyph />}
            <Text style={[styles.name, badge.earned && styles.nameEarned]}>{badge.name}</Text>
            <Text style={[styles.hint, badge.earned && styles.hintEarned]}>{badge.hint}</Text>
            {!badge.earned && badge.progress ? (
              <View style={styles.track}>
                <View
                  style={[styles.trackFill, { width: `${Math.round(badge.progress * 100)}%` }]}
                />
              </View>
            ) : null}
          </View>
        </FadeIn>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  cell: { width: '48.5%' },
  badge: {
    minHeight: 118,
    borderRadius: radius.md,
    borderWidth: stroke.hairline,
    borderBottomWidth: lip.rest,
    padding: space.md,
    gap: space.xs,
  },
  locked: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderBottomColor: colors.border,
  },
  earned: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLip,
    borderBottomColor: colors.primaryLip,
  },
  glyph: { alignSelf: 'flex-start', alignItems: 'center', marginBottom: space.xs },
  lockShackle: {
    width: 13,
    height: 9,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 2.5,
    borderBottomWidth: 0,
    borderColor: colors.textMuted,
  },
  lockBody: { width: 19, height: 14, borderRadius: 3, backgroundColor: colors.textMuted },
  check: {
    width: 15,
    height: 8,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.onColor,
    transform: [{ rotate: '-45deg' }],
    marginBottom: 6,
  },
  name: { fontSize: font.body, fontFamily: fonts.semiBold, color: colors.text },
  nameEarned: { color: colors.onColor },
  hint: { fontFamily: fonts.regular, fontSize: font.small, color: colors.textMuted },
  hintEarned: { color: colors.teal100 },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    marginTop: 'auto',
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
});
