/**
 * A US stop sign drawn with plain Views (no SVG library): a red octagon with a
 * white rim and "STOP". Static on purpose: it is a reminder on the driving
 * screen, never an alert (alerts are voice only, §7).
 */
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

/**
 * Regular octagon = a square clipped by the same square turned 45°. The outer
 * View is rotated and clips; the inner one turns back so it sits upright.
 */
function Octagon({ size, color }: { size: number; color: string }) {
  return (
    <View style={[styles.clip, { width: size, height: size }]}>
      <View style={[styles.fill, { width: size, height: size, backgroundColor: color }]} />
    </View>
  );
}

export function StopSign({ size }: { size: number }) {
  const inner = size * 0.9;
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Stop sign"
    >
      <Octagon size={size} color={colors.white} />
      <View style={[styles.center, StyleSheet.absoluteFill]}>
        <Octagon size={inner} color={colors.harsh} />
      </View>
      <View style={[styles.center, StyleSheet.absoluteFill]}>
        <Text style={[styles.word, { fontSize: size * 0.27 }]} allowFontScaling={false}>
          STOP
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', transform: [{ rotate: '45deg' }] },
  fill: { transform: [{ rotate: '-45deg' }] },
  center: { alignItems: 'center', justifyContent: 'center' },
  word: { color: colors.white, fontWeight: '900', letterSpacing: 2 },
});
