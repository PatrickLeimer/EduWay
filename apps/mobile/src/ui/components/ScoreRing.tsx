/**
 * Trip score badge. Deliberately one neutral color: score bands would be new
 * thresholds, and those belong in packages/shared/src/thresholds.ts.
 */
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, fonts } from '../theme';

export function ScoreRing({ score, size = 120 }: { score: number | null; size?: number }) {
  return (
    <View
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityLabel={score == null ? 'Not scored' : `Score ${Math.round(score)} of 100`}
    >
      <Text style={[styles.value, { fontSize: size * 0.36 }]}>
        {score == null ? '--' : Math.round(score)}
      </Text>
      <Text style={styles.label}>{score == null ? 'not scored' : 'of 100'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 8,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  value: { fontFamily: fonts.semiBold, color: colors.text },
  label: { fontFamily: fonts.regular, fontSize: font.small, color: colors.textMuted },
});
