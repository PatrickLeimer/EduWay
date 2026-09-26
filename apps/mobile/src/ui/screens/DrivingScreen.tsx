/**
 * Screen 2 (§12): Driving mode. Always dark, glanceable, CarPlay-like:
 * map that follows the car, speed, speed limit, trip time and distance.
 *
 * Rules from the master doc this screen follows:
 * - No event list and no visual alerts: live alerts are voice only (§7).
 * - Nothing needs a tap while moving (§16). The map is not interactive.
 * - Every touch is reported for phone-use detection (§7), except Emergency
 *   and Directions, which always stay available (§4). Those live outside the
 *   touch-reporting view on purpose.
 * - End only after being stopped 30+ s; TripSession.canEnd() says why not (§4).
 */
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, BackHandler, Linking, StyleSheet, Text, View } from 'react-native';

import { useTripState } from '../../trip';
import { Button } from '../components/Button';
import { MapCanvas } from '../components/MapCanvas';
import { OsmCredit } from '../components/primitives';
import { SpeedLimitSign } from '../components/SpeedLimitSign';
import { TestDriveBadge } from '../components/TestDriveBadge';
import { clockText, speedMphText } from '../lib/format';
import { directionsUrl, EMERGENCY_NUMBER, emergencyUrl } from '../lib/links';
import type { ScreenProps } from '../navigation';
import { colors, font, radius, SAFE_BOTTOM, SAFE_TOP, space } from '../theme';

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

  const fix = state.latestFix;
  const here = fix ? { latitude: fix.lat, longitude: fix.lon } : null;
  const road = state.latestRoad;
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
      <View style={styles.fill} onTouchStart={() => trip.reportTouch()}>
        <MapCanvas
          style={StyleSheet.absoluteFill}
          follow={here}
          car={here}
          dark
          interactive={false}
        />

        <View style={styles.hud}>
          <View style={styles.speedBox}>
            <Text style={styles.speed}>{speedMphText(fix?.speedMps)}</Text>
            <Text style={styles.unit}>mph</Text>
          </View>
          <View style={styles.limitBox}>
            <SpeedLimitSign
              limitMph={road?.limitMph ?? null}
              confidence={road?.limitConfidence ?? null}
            />
          </View>
        </View>
        {road?.street ? (
          <View style={styles.streetPill}>
            <Text style={styles.street} numberOfLines={1}>
              {road.street}
            </Text>
          </View>
        ) : null}

        <View style={styles.bottom}>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{clockText(elapsedS)}</Text>
              <Text style={styles.statLabel}>time</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{state.distanceMi.toFixed(1)}</Text>
              <Text style={styles.statLabel}>miles</Text>
            </View>
          </View>
          {state.status === 'starting' ? (
            <Text style={styles.status}>Starting drive…</Text>
          ) : (
            <Button
              title={canEnd.ok ? 'End drive' : (canEnd.reason ?? 'Stop to end the drive')}
              variant={canEnd.ok ? 'danger' : 'onDark'}
              large
              disabled={!canEnd.ok}
              onPress={() => void trip.end()}
            />
          )}
          <OsmCredit dark />
        </View>
      </View>

      {/* Always available, not reported as phone use (§4, §7). */}
      <View style={styles.safetyBar}>
        {settings.demoMode ? (
          <TestDriveBadge />
        ) : state.options?.lockEnabled ? (
          <Text style={styles.lock}>Driving lock on</Text>
        ) : null}
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
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  fill: { flex: 1 },
  hud: {
    marginTop: SAFE_TOP + 64,
    marginHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speedBox: {
    backgroundColor: colors.drivePanel,
    borderRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.driveBorder,
  },
  speed: { fontSize: font.speed, fontWeight: '800', color: colors.textOnDark, lineHeight: 104 },
  unit: { fontSize: font.driveMin, color: colors.textOnDarkMuted, marginTop: -8 },
  limitBox: { alignSelf: 'flex-start' },
  streetPill: {
    alignSelf: 'flex-start',
    marginTop: space.md,
    marginHorizontal: space.lg,
    backgroundColor: colors.drivePanel,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    maxWidth: '90%',
  },
  street: { fontSize: font.driveMin, color: colors.textOnDark, fontWeight: '600' },
  bottom: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: SAFE_BOTTOM,
    backgroundColor: colors.drivePanel,
    borderRadius: radius.xl,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.driveBorder,
    gap: space.md,
  },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '700', color: colors.textOnDark },
  statLabel: { fontSize: font.driveMin, color: colors.textOnDarkMuted },
  status: {
    fontSize: font.driveMin,
    color: colors.textOnDarkMuted,
    textAlign: 'center',
    paddingVertical: space.lg,
  },
  safetyBar: {
    position: 'absolute',
    top: SAFE_TOP,
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lock: { fontSize: font.small, color: colors.textOnDarkMuted },
  safetyButtons: { flexDirection: 'row', gap: space.sm, marginLeft: 'auto' },
  errorTitle: { fontSize: font.title, fontWeight: '700', color: colors.textOnDark },
  errorText: { fontSize: font.body, color: colors.textOnDarkMuted, textAlign: 'center' },
});
