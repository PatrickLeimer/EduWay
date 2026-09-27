/** Small "TEST DRIVE" label so nobody mistakes a simulated drive for a real one. */
import { StyleSheet, Text } from 'react-native';

import { colors, font, fonts, radius, space } from '../theme';

export function TestDriveBadge() {
  return <Text style={styles.badge}>TEST DRIVE</Text>;
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.coach,
    color: colors.text,
    fontSize: font.small,
    fontFamily: fonts.semiBold,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
