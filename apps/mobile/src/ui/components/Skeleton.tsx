/**
 * Loading placeholders in the shape of the content that is coming (the
 * Facebook / YouTube "skeleton" pattern), so a screen never jumps from a lone
 * spinner to a full layout. Blocks breathe gently; with "Reduce motion" on
 * they stay still.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type DimensionValue } from 'react-native';

import { colors, edge, radius, space } from '../theme';
import { useReducedMotion } from './motion';

const PULSE_MS = 900;

/** Shared breathing opacity, so every block on a screen pulses together. */
function usePulse(): Animated.Value {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) return;
    const ease = Easing.inOut(Easing.quad);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 0.45,
          duration: PULSE_MS,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 1,
          duration: PULSE_MS,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, reduced]);
  return value;
}

export function SkeletonBlock({
  height,
  width = '100%',
  round = radius.md,
}: {
  height: number;
  width?: DimensionValue;
  round?: number;
}) {
  return <View style={[styles.block, { height, width, borderRadius: round }]} />;
}

/** A card-shaped placeholder: optional media area on top, then text lines. */
function SkeletonCard({ media, lines }: { media?: number; lines: DimensionValue[] }) {
  return (
    <View style={styles.card}>
      {media ? <SkeletonBlock height={media} round={0} /> : null}
      <View style={styles.cardBody}>
        {lines.map((w, i) => (
          <SkeletonBlock key={i} height={i === 0 ? 18 : 12} width={w} round={radius.sm} />
        ))}
      </View>
    </View>
  );
}

/**
 * Placeholders for a whole screen while its data loads.
 * - `trips`: Past drives cards (map preview + two lines).
 * - `summary`: one hero card, then rows (Infractions, Growth, Progress).
 * - `replay`: the map, the speed timeline and the play controls.
 */
export function SkeletonScreen({ variant }: { variant: 'trips' | 'summary' | 'replay' }) {
  const pulse = usePulse();
  return (
    <Animated.View
      style={[styles.screen, { opacity: pulse }]}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {variant === 'trips' ? (
        [0, 1, 2].map((i) => <SkeletonCard key={i} media={130} lines={['55%', '80%']} />)
      ) : variant === 'replay' ? (
        <>
          <SkeletonBlock height={320} round={radius.lg} />
          <View style={styles.padded}>
            <SkeletonBlock height={56} />
            <SkeletonBlock height={72} />
            <SkeletonBlock height={52} />
          </View>
        </>
      ) : (
        <>
          <SkeletonCard lines={['30%', '70%', '50%']} />
          <SkeletonBlock height={22} width="40%" round={radius.sm} />
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} height={56} />
          ))}
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: space.lg },
  block: { backgroundColor: colors.surfaceAlt },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...edge,
  },
  cardBody: { padding: space.lg, gap: space.sm },
  padded: { gap: space.md },
});
