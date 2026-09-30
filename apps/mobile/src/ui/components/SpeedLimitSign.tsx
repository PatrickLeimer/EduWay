/**
 * US-style speed limit sign for driving mode. Informational only: it never
 * changes color when the driver is over the limit, because live alerts are
 * voice only, never visual (§7).
 */
import type { LimitConfidence } from '@eduway/shared';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, fonts } from '../theme';

export function SpeedLimitSign({
  limitMph,
  confidence,
}: {
  limitMph: number | null;
  confidence: LimitConfidence | null;
}) {
  return (
    <View style={styles.sign} accessibilityLabel={`Speed limit ${limitMph ?? 'unknown'}`}>
      <Text style={styles.top}>SPEED{'\n'}LIMIT</Text>
      <Text style={styles.value}>{limitMph ?? '--'}</Text>
      {/* Inferred limits come from the road type, not a posted sign (§8). */}
      {confidence === 'inferred' ? <Text style={styles.est}>est.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sign: {
    width: 84,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: colors.black,
    alignItems: 'center',
  },
  top: {
    fontSize: font.tiny,
    fontFamily: fonts.semiBold,
    color: colors.black,
    textAlign: 'center',
    lineHeight: 12,
  },
  value: { fontSize: 36, fontFamily: fonts.semiBold, color: colors.black },
  est: { fontFamily: fonts.regular, fontSize: font.tiny, color: colors.textMuted },
});
