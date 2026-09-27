/**
 * Trip concluded: the first post-trip screen (§12 screen 3). A big loading
 * state while the trip uploads and the server scores and coaches it, then the
 * score reveal and Next into the post-trip flow (lib/flow.ts). No map here:
 * the route is shown only in Replay.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useTripState } from '../../trip';
import { Button } from '../components/Button';
import { FadeIn, useReducedMotion } from '../components/motion';
import { StatTile } from '../components/primitives';
import { ScoreRing } from '../components/ScoreRing';
import { durationText, milesText, secondsBetween } from '../lib/format';
import type { ScreenProps } from '../navigation';
import { colors, font, motion, SAFE_BOTTOM, SAFE_TOP, space } from '../theme';

/** What the server does after upload, in order (routes/trips.ts): shown while waiting. */
const STAGES = ['Saving your route', 'Scoring your drive', 'Your coach is reviewing your drive'];
const STAGE_MS = 2600;

function useStage(active: boolean): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), STAGE_MS);
    return () => clearInterval(id);
  }, [active]);
  return stage;
}

/** A soft ring that breathes behind the spinner. Still when "Reduce motion" is on. */
function Pulse() {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  return <Animated.View style={[styles.pulse, { opacity, transform: [{ scale }] }]} />;
}

export function TripEndedScreen({ modules, navigate }: ScreenProps) {
  const trip = modules.trip;
  const state = useTripState(trip);
  const waiting = state.status !== 'done' && state.status !== 'queued' && state.status !== 'error';
  const stage = useStage(waiting);

  const goHome = () => {
    trip.reset();
    navigate({ name: 'start' });
  };

  const result = state.result;
  const timeText = result
    ? durationText(secondsBetween(result.trip.startedAt, result.trip.endedAt))
    : '…';

  let body;
  let footer = null;
  if (state.status === 'done' && result) {
    body = (
      <FadeIn style={styles.center} fromScale={0.9} fromY={0} duration={motion.slow}>
        <ScoreRing score={result.trip.score} size={184} />
        <Text style={styles.headline}>
          {result.trip.passenger ? 'Passenger trip saved' : 'Your drive is ready'}
        </Text>
        <Text style={styles.sub}>
          {result.coach
            ? 'Let’s look back at your drive, then hear from your coach.'
            : 'Let’s look back at your drive.'}
        </Text>
        <View style={styles.tiles}>
          <StatTile label="Distance" value={milesText(result.trip.distanceMi)} />
          <StatTile label="Time" value={timeText} />
        </View>
      </FadeIn>
    );
    footer = (
      <Button
        title="Next"
        large
        onPress={() => navigate({ name: 'replay', tripId: result.trip._id, origin: 'trip' })}
      />
    );
  } else if (state.status === 'queued') {
    body = (
      <FadeIn style={styles.center} fromY={10}>
        <Text style={styles.headline}>Saved on this phone</Text>
        <Text style={styles.sub}>
          No connection right now. Your drive will upload automatically, and your coaching will be
          in Past drives.
        </Text>
      </FadeIn>
    );
    footer = <Button title="Back to home" large onPress={goHome} />;
  } else if (state.status === 'error') {
    body = (
      <FadeIn style={styles.center} fromY={10}>
        <Text style={styles.headline}>Something went wrong</Text>
        <Text style={[styles.sub, styles.error]}>{state.error ?? 'Upload failed'}</Text>
      </FadeIn>
    );
    footer = <Button title="Back to home" large onPress={goHome} />;
  } else {
    body = (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <View style={styles.spinnerWrap}>
          <Pulse />
          <ActivityIndicator size="large" color={colors.route} style={styles.spinner} />
        </View>
        {/* Keyed so each stage fades in. */}
        <FadeIn key={stage} fromY={6} duration={motion.normal}>
          <Text style={styles.headline}>{STAGES[stage]}…</Text>
        </FadeIn>
        <Text style={styles.sub}>This usually takes a few seconds.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FadeIn delay={motion.fast / 2} fromY={8}>
        <Text style={styles.title}>Trip concluded</Text>
      </FadeIn>
      <View style={styles.body}>{body}</View>
      {footer ? (
        <FadeIn delay={motion.normal} fromY={24} style={styles.footer}>
          {footer}
        </FadeIn>
      ) : null}
    </View>
  );
}

const SPINNER = 168;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingTop: SAFE_TOP,
    paddingHorizontal: space.lg,
  },
  title: { fontSize: font.display, fontWeight: '800', color: colors.text },
  body: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: space.md },
  spinnerWrap: {
    width: SPINNER,
    height: SPINNER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xl,
  },
  pulse: {
    position: 'absolute',
    width: SPINNER,
    height: SPINNER,
    borderRadius: SPINNER / 2,
    backgroundColor: colors.route,
  },
  spinner: { transform: [{ scale: 1.8 }] },
  headline: { fontSize: font.title, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sub: {
    fontSize: font.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  },
  error: { color: colors.harsh },
  tiles: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, alignSelf: 'stretch' },
  footer: { paddingTop: space.md, paddingBottom: SAFE_BOTTOM + space.sm },
});
