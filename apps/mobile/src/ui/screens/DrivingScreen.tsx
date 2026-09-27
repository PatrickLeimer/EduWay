/**
 * Screen 2 (§12): Driving mode. A near-blank dark screen with only the trip
 * time and a big stop sign reading "Eyes on the road". No map, speed or street
 * while driving: the map is shown only in Replay.
 *
 * Rules from the master doc this screen follows:
 * - No event list and no visual alerts: live alerts are voice only (§7).
 * - Nothing needs a tap while moving (§16).
 * - Every touch is reported for phone-use detection (§7), except Emergency
 *   and Directions, which always stay available (§4). Those live outside the
 *   touch-reporting view on purpose.
 * - End only after being stopped 30+ s (§4); the button appears only then.
 */
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Linking,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useTripState } from '../../trip';
import { Button } from '../components/Button';
import { FadeIn } from '../components/motion';
import { StopSign } from '../components/StopSign';
import { TestDriveBadge } from '../components/TestDriveBadge';
import { clockText } from '../lib/format';
import { directionsUrl, EMERGENCY_NUMBER, emergencyUrl } from '../lib/links';
import type { ScreenProps } from '../navigation';
import { colors, font, motion, SAFE_BOTTOM, SAFE_TOP, space } from '../theme';

/** Re-renders once a second so the trip clock ticks. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function DrivingScreen({ modules, navigate, settings }: ScreenProps) {
  const trip = modules.trip;
  const state = useTripState(trip);
  const now = useNow();
  const canEnd = trip.canEnd();
  const { width } = useWindowDimensions();
  const signSize = Math.min(width * 0.72, 320);

  // Once End is accepted the trip uploads; the ended screen shows progress.
  useEffect(() => {
    if (state.status === 'uploading' || state.status === 'queued' || state.status === 'done') {
      navigate({ name: 'ended' });
    }
  }, [state.status, navigate]);

  // Android back button can't leave driving mode (§4 lock, §16).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const elapsedS = state.tripStartedAt ? (now - Date.parse(state.tripStartedAt)) / 1000 : 0;

  const callEmergency = () =>
    Alert.alert(`Call ${EMERGENCY_NUMBER}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', style: 'destructive', onPress: () => void Linking.openURL(emergencyUrl()) },
    ]);

  if (state.status === 'error') {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="light" />
        <Text style={styles.errorTitle}>Could not start the drive</Text>
        <Text style={styles.errorText}>{state.error ?? 'Unknown error'}</Text>
        <Button
          title="Back to home"
          variant="onDark"
          large
          onPress={() => {
            trip.reset();
            navigate({ name: 'start' });
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Everything in here counts as a phone touch while moving (§7). */}
      <View style={[styles.fill, styles.center]} onTouchStart={() => trip.reportTouch()}>
        <FadeIn style={styles.center} delay={motion.normal} fromY={0}>
          <Text style={styles.time} allowFontScaling={false}>
            {clockText(elapsedS)}
          </Text>
          <Text style={styles.timeLabel}>
            {state.status === 'starting' ? 'Starting drive…' : 'Trip time'}
          </Text>
        </FadeIn>

        <FadeIn style={styles.sign} delay={motion.slow} fromScale={0.94} fromY={0}>
          <StopSign size={signSize} />
          <Text style={styles.eyes} allowFontScaling={false}>
            EYES ON THE ROAD
          </Text>
        </FadeIn>

        {canEnd.ok && state.status !== 'starting' ? (
          <FadeIn style={styles.bottom} fromY={40}>
            <Button title="End drive" variant="danger" large onPress={() => void trip.end()} />
          </FadeIn>
        ) : null}
      </View>

      {/* Always available, not reported as phone use (§4, §7). */}
      <View style={styles.safetyBar}>
        {settings.demoMode ? <TestDriveBadge /> : null}
        <View style={styles.safetyButtons}>
          <Button
            title="Directions"
            variant="onDark"
            onPress={() => void Linking.openURL(directionsUrl())}
          />
          <Button
            title={`Emergency ${EMERGENCY_NUMBER}`}
            variant="danger"
            onPress={callEmergency}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.driveBg },
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  time: {
    fontSize: font.speed,
    fontWeight: '800',
    color: colors.textOnDark,
    fontVariant: ['tabular-nums'],
  },
  timeLabel: { fontSize: font.driveMin, color: colors.textOnDarkMuted, marginTop: -space.sm },
  sign: { alignItems: 'center', gap: space.xl, marginTop: space.xl },
  eyes: {
    fontSize: 40,
    fontWeight: '900',
    color: colors.textOnDark,
    textAlign: 'center',
    letterSpacing: 1,
  },
  bottom: { position: 'absolute', left: space.lg, right: space.lg, bottom: SAFE_BOTTOM },
  safetyBar: {
    position: 'absolute',
    top: SAFE_TOP,
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  safetyButtons: { flexDirection: 'row', gap: space.sm, marginLeft: 'auto' },
  errorTitle: { fontSize: font.title, fontWeight: '700', color: colors.textOnDark },
  errorText: { fontSize: font.body, color: colors.textOnDarkMuted, textAlign: 'center' },
});
