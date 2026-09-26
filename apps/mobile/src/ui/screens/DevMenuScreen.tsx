/**
 * Developer tools: everything needed before a test drive or a presentation.
 * - Mode: Test drive switch + which modules are real or simulated right now.
 * - Server: the API URL the app uses and a one-tap connection check.
 * - Live trip: status, GPS, road match and counters, updating every fix.
 * - Links to the WS1–WS4 debug screens and the drive recorder.
 */
import { DEMO_USER_ID } from '@edudriver/shared';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '../../api';
import { useTripState } from '../../trip';
import { DEMO_FLAGS, USE_REAL, type ModuleFlags } from '../../wiring';
import { Button } from '../components/Button';
import { Card, Muted, SectionTitle } from '../components/primitives';
import { Screen } from '../components/Screen';
import { TestDriveToggle } from '../components/TestDriveToggle';
import { speedMphText } from '../lib/format';
import type { ScreenProps } from '../navigation';
import { colors, font, space } from '../theme';

const MODULE_ROWS: { key: keyof ModuleFlags; label: string; real: string; mock: string }[] = [
  { key: 'gps', label: 'GPS', real: 'phone GPS', mock: 'recorded drive' },
  { key: 'detection', label: 'Motion detection', real: 'phone sensors', mock: 'recorded events' },
  { key: 'road', label: 'Road data', real: 'OpenStreetMap', mock: 'fixture' },
  { key: 'voice', label: 'Voice', real: 'ElevenLabs clips', mock: 'silent mock' },
  { key: 'api', label: 'Server', real: 'real server', mock: 'mock data' },
  { key: 'trip', label: 'Trip session', real: 'real', mock: 'mock' },
];

type Check =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; text: string }
  | { state: 'fail'; text: string };

function Row({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, warn && styles.warn]}>{value}</Text>
    </View>
  );
}

export function DevMenuScreen({ modules, navigate, settings, updateSettings }: ScreenProps) {
  const state = useTripState(modules.trip);
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const flags = settings.demoMode ? DEMO_FLAGS : USE_REAL;

  const testServer = async () => {
    setCheck({ state: 'checking' });
    const started = Date.now();
    try {
      const { trips } = await modules.api.listTrips(DEMO_USER_ID);
      setCheck({
        state: 'ok',
        text: `Connected in ${Date.now() - started} ms · ${trips.length} trips`,
      });
    } catch (e) {
      setCheck({ state: 'fail', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const fix = state.latestFix;
  const road = state.latestRoad;

  return (
    <Screen
      title="Developer tools"
      onBack={() => navigate({ name: 'settings' })}
      backLabel="Settings"
    >
      <SectionTitle>Mode</SectionTitle>
      <Card>
        <TestDriveToggle modules={modules} settings={settings} updateSettings={updateSettings} />
        <View style={styles.divider} />
        {MODULE_ROWS.map((m) => (
          <Row
            key={m.key}
            label={m.label}
            value={flags[m.key] ? m.real : m.mock}
            warn={!flags[m.key]}
          />
        ))}
      </Card>

      <SectionTitle>Server</SectionTitle>
      <Card>
        <Row label="API URL" value={flags.api ? API_BASE_URL : 'mock (no network)'} />
        {API_BASE_URL.includes('localhost') && flags.api ? (
          <Muted>
            localhost only works in a simulator. On a phone, set EXPO_PUBLIC_API_URL in
            apps/mobile/.env to the LAN IP of your laptop and restart Expo.
          </Muted>
        ) : null}
        <Button
          title={check.state === 'checking' ? 'Checking…' : 'Test connection'}
          variant="secondary"
          disabled={check.state === 'checking'}
          onPress={() => void testServer()}
          style={styles.button}
        />
        {check.state === 'ok' ? <Text style={styles.ok}>{check.text}</Text> : null}
        {check.state === 'fail' ? <Text style={styles.fail}>{check.text}</Text> : null}
      </Card>

      <SectionTitle>Live trip</SectionTitle>
      <Card>
        <Row label="Status" value={state.status} warn={state.status === 'error'} />
        {state.error ? <Text style={styles.fail}>{state.error}</Text> : null}
        <Row
          label="GPS"
          value={fix ? `${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}` : 'no fix yet'}
          warn={!fix}
        />
        <Row
          label="Speed / accuracy"
          value={
            fix
              ? `${speedMphText(fix.speedMps)} mph · ±${fix.accuracyM?.toFixed(0) ?? '?'} m`
              : '--'
          }
        />
        <Row
          label="Road"
          value={
            road
              ? `${road.street ?? 'unnamed'} · ${road.limitMph ?? '?'} mph (${road.limitConfidence})`
              : 'no match'
          }
          warn={state.status === 'driving' && !road}
        />
        <Row label="Events" value={String(state.events.length)} />
        <Row label="Trace fixes" value={String(state.traceLength)} />
        <Row label="Distance" value={`${state.distanceMi.toFixed(2)} mi`} />
        <Row label="Stopped for" value={`${Math.round(state.stoppedForS)} s`} />
      </Card>

      <SectionTitle>Debug screens</SectionTitle>
      <View style={styles.links}>
        <Button
          title="Drive recorder (test drives)"
          variant="secondary"
          onPress={() => navigate({ name: 'recorder' })}
        />
        <Button
          title="WS1 Motion detection"
          variant="secondary"
          onPress={() => navigate({ name: 'ws1' })}
        />
        <Button
          title="WS2 Road + trip"
          variant="secondary"
          onPress={() => navigate({ name: 'ws2' })}
        />
        <Button
          title="WS3 Backend + API"
          variant="secondary"
          onPress={() => navigate({ name: 'ws3' })}
        />
        <Button
          title="WS4 Coaching + voice"
          variant="secondary"
          onPress={() => navigate({ name: 'ws4' })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
  },
  rowLabel: { fontSize: font.body, color: colors.textMuted },
  rowValue: { flexShrink: 1, fontSize: font.body, color: colors.text, textAlign: 'right' },
  warn: { color: colors.coach, fontWeight: '600' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: space.sm,
  },
  button: { marginTop: space.md },
  ok: { color: colors.good, fontSize: font.body, marginTop: space.sm },
  fail: { color: colors.harsh, fontSize: font.body, marginTop: space.sm },
  links: { gap: space.sm },
});
