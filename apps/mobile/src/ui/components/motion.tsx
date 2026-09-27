/**
 * Motion for the whole app, built on React Native's Animated API (no library).
 * Everything eases out on a cubic curve and runs on the native driver
 * (opacity/transform only). When the OS "Reduce motion" setting is on,
 * content appears without movement.
 *
 * Timings live in theme.ts (`motion`); tweak them there.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { TransitionKind } from '../lib/transitions';
import { motion } from '../theme';

const EASE_OUT = Easing.out(Easing.cubic);

/** True when the user asked the OS for reduced motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduced(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Entrance delay for item `index` of a list (capped, see motion.maxStaggerItems). */
export function staggerDelay(index: number, base = 0): number {
  return base + Math.min(index, motion.maxStaggerItems) * motion.stagger;
}

/** 0 → 1 once on mount, after `delay` ms. */
function useEntrance(delay: number, duration: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(value, {
      toValue: 1,
      duration,
      delay,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [value, delay, duration]);
  return value;
}

interface FadeInProps {
  children: ReactNode;
  /** ms before starting; use `index * motion.stagger` for lists. */
  delay?: number;
  duration?: number;
  /** Start this many points lower (positive) or higher (negative). */
  fromY?: number;
  fromX?: number;
  /** Start slightly smaller (e.g. 0.96) for a "pop". */
  fromScale?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fades and slides its children in once, on mount. */
export function FadeIn({
  children,
  delay = 0,
  duration = motion.normal,
  fromY = 12,
  fromX = 0,
  fromScale = 1,
  style,
}: FadeInProps) {
  const reduced = useReducedMotion();
  const t = useEntrance(delay, duration);
  if (reduced) return <Animated.View style={style}>{children}</Animated.View>;
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }) },
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [fromScale, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const TRANSITION: Record<TransitionKind, { fromX: number; fromY: number; fromScale: number }> = {
  /** Deeper screen: slides in from the right. */
  forward: { fromX: 48, fromY: 0, fromScale: 1 },
  /** Going back: slides in from the left. */
  back: { fromX: -48, fromY: 0, fromScale: 1 },
  /** Entering driving mode: rises and settles, like a mode change. */
  up: { fromX: 0, fromY: 60, fromScale: 0.98 },
  /** Same level (e.g. Home ↔ Settings siblings): plain fade. */
  fade: { fromX: 0, fromY: 0, fromScale: 1 },
};

/** Wraps a whole screen; give it a new `key` per route so it replays. */
export function ScreenTransition({
  kind,
  children,
}: {
  kind: TransitionKind;
  children: ReactNode;
}) {
  const t = TRANSITION[kind];
  return (
    <FadeIn
      style={{ flex: 1 }}
      duration={motion.screen}
      fromX={t.fromX}
      fromY={t.fromY}
      fromScale={t.fromScale}
    >
      {children}
    </FadeIn>
  );
}

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  /** Applied to the animated wrapper (layout: flex, margins, size). */
  style?: StyleProp<ViewStyle>;
  /** Applied to the Pressable itself (look: background, padding, radius). */
  contentStyle?: StyleProp<ViewStyle>;
  /** How far it shrinks while held. */
  pressedScale?: number;
}

/** Pressable that gently shrinks while held and springs back on release. */
export function PressableScale({
  children,
  style,
  contentStyle,
  pressedScale = 0.97,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Pressable
        {...rest}
        disabled={disabled}
        style={contentStyle}
        onPressIn={(e) => {
          if (!disabled) to(pressedScale);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          to(1);
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Bar that grows from its bottom edge (score trend, speed timeline). */
export function GrowBar({ style, delay = 0 }: { style: StyleProp<ViewStyle>; delay?: number }) {
  const reduced = useReducedMotion();
  const t = useEntrance(delay, motion.slow);
  if (reduced) return <Animated.View style={style} />;
  return (
    <Animated.View
      style={[style, { transformOrigin: 'bottom', opacity: t, transform: [{ scaleY: t }] }]}
    />
  );
}
