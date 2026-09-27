/**
 * Trip score drawn as a road that loops back to a checkered 100 marker: the
 * driven arc fills in, a car drives to the score and parks there, and the
 * number counts up alongside it.
 *
 * Deliberately one neutral road color: score bands would be new thresholds,
 * and those belong in packages/shared/src/thresholds.ts.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { colors, font, fonts, stroke } from '../theme';
import { useReducedMotion } from './motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Road width as a share of the ring's diameter. */
const BAND_RATIO = 0.13;
/** Lane dash pattern along the road, in points. */
const LANE_DASH = '6 10';
/** Checkered 100 marker: squares across the road, and rows along it. */
const FINISH_COLS = 4;
const FINISH_ROWS = 2;
const FINISH_ROW_H = 3.5;
/** Car size relative to the road width. */
const CAR_LENGTH_RATIO = 0.8;
const CAR_WIDTH_RATIO = 0.52;
/** One duration for every score, so the reveal always feels the same. */
const DRIVE_MS = 2000;
/** Pulls away and parks, rather than easing evenly. */
const DRIVE_EASING = Easing.bezier(0.55, 0.05, 0.65, 0.2);

export interface ScoreRingProps {
  /** null = passenger trip: the road is drawn, but nobody drove it. */
  score: number | null;
  size?: number;
  label?: string;
  animate?: boolean;
}

/**
 * The fixed 100 marker at 12 o'clock. Drawn in the rotated SVG space, where
 * +x points up the screen, so the checkers run across the road.
 */
function FinishLine({ center, radius, band }: { center: number; radius: number; band: number }) {
  const colW = band / FINISH_COLS;
  const x0 = center + radius - band / 2;
  const y0 = center - (FINISH_ROWS * FINISH_ROW_H) / 2;
  const squares = [];
  for (let row = 0; row < FINISH_ROWS; row++) {
    for (let col = 0; col < FINISH_COLS; col++) {
      squares.push(
        <Rect
          key={`${row}-${col}`}
          x={x0 + col * colW}
          y={y0 + row * FINISH_ROW_H}
          width={colW}
          height={FINISH_ROW_H}
          fill={(row + col) % 2 === 0 ? colors.roadFinish : colors.white}
        />,
      );
    }
  }
  return <>{squares}</>;
}

/** Top-down car, nose pointing along the direction of travel. */
function Car({ band, radius }: { band: number; radius: number }) {
  const length = band * CAR_LENGTH_RATIO;
  const width = band * CAR_WIDTH_RATIO;
  return (
    <View
      style={[
        styles.car,
        {
          width: length,
          height: width,
          borderRadius: width / 3,
          transform: [{ translateY: -radius }],
        },
      ]}
    >
      <View
        style={[
          styles.windshield,
          { width: length * 0.22, height: width * 0.6, right: length * 0.18 },
        ]}
      />
    </View>
  );
}

export function ScoreRing({ score, size = 120, label = 'of 100', animate = true }: ScoreRingProps) {
  const band = Math.round(size * BAND_RATIO);
  const center = size / 2;
  const radius = (size - band) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = score == null ? 0 : Math.max(0, Math.min(100, score));

  const reduced = useReducedMotion();
  const still = reduced || !animate;
  // One value drives the arc, the car and the counter, so they stay in lockstep.
  // It holds the current score, so a later score animates on from there.
  const [driven] = useState(() => new Animated.Value(0));
  const [shown, setShown] = useState(() => (still ? Math.round(target) : 0));

  useEffect(() => {
    const id = driven.addListener(({ value }) => {
      const rounded = Math.round(value);
      setShown((prev) => (prev === rounded ? prev : rounded));
    });
    return () => driven.removeListener(id);
  }, [driven]);

  useEffect(() => {
    if (still) {
      driven.setValue(target);
      return;
    }
    const anim = Animated.timing(driven, {
      toValue: target,
      duration: DRIVE_MS,
      easing: DRIVE_EASING,
      // SVG stroke props and the counter both need JS-side values.
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [driven, still, target]);

  const dashoffset = driven.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] });
  const rotate = driven.interpolate({ inputRange: [0, 100], outputRange: ['0deg', '360deg'] });

  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      accessibilityLabel={score == null ? 'Not scored' : `Score ${Math.round(score)} of 100`}
    >
      {/* Rotated so zero sits at 12 o'clock and the road runs clockwise. */}
      <Svg width={size} height={size} style={styles.rotated}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.roadMuted}
          strokeWidth={band}
          fill="none"
        />
        {score == null ? null : (
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.road}
            strokeWidth={band}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={[circumference, circumference]}
            strokeDashoffset={dashoffset}
          />
        )}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.roadLane}
          strokeWidth={stroke.outline}
          strokeDasharray={LANE_DASH}
          fill="none"
        />
        <FinishLine center={center} radius={radius} band={band} />
      </Svg>

      {/* Rotating the whole layer walks the car along the arc and aims it down
          the direction of travel, so it can never slide sideways. */}
      {score == null ? null : (
        <Animated.View style={[styles.carLayer, { transform: [{ rotate }] }]} pointerEvents="none">
          <Car band={band} radius={radius} />
        </Animated.View>
      )}

      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.value, { fontSize: size * 0.32 }]}>
          {score == null ? '--' : shown}
        </Text>
        <Text style={styles.label}>{score == null ? 'not scored' : label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  rotated: { transform: [{ rotate: '-90deg' }] },
  carLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  car: {
    backgroundColor: colors.roadLane,
    borderWidth: stroke.hairline,
    borderColor: colors.road,
    alignItems: 'center',
    justifyContent: 'center',
  },
  windshield: { position: 'absolute', backgroundColor: colors.road, borderRadius: 1 },
  center: { position: 'absolute', alignItems: 'center' },
  value: { fontFamily: fonts.semiBold, color: colors.text },
  label: { fontFamily: fonts.regular, fontSize: font.small, color: colors.textMuted },
});
