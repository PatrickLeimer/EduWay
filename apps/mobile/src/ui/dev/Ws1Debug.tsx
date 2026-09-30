/**
 * WS1 debug screen (owned by WS1). Live motion readings for the §14 Friday goal
 * ("Live readings on screen; units verified": |accG| ≈ 9.8 m/s² on a still
 * phone) and a test-drive view (§15: one drives, one watches): GPS feed and
 * the events the detector and phone use monitor emit.
 *
 * GPS comes from trip/'s location sources. The real one is WS2's; until it
 * lands, use the fixture replay to check the wiring.
 */
import { MPS_TO_MPH, type DraftEvent, type GpsFix, type MotionSample } from '@eduway/shared';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, ScrollView, Text, View } from 'react-native';

import { createExpoLocationSource, createFixtureLocationSource } from '../../trip';
import type { ScreenProps } from '../navigation';

const f = (n: number) => n.toFixed(2);
const MAX_EVENTS = 30;

export function Ws1Debug({ modules }: ScreenProps) {
  useKeepAwake();
  const { motionSource, motionDetector, phoneUse } = modules;
  const [sample, setSample] = useState<MotionSample | null>(null);
  const [hz, setHz] = useState<number | null>(null);
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [events, setEvents] = useState<DraftEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [fixtureGps, setFixtureGps] = useState(false);
  const latestFix = useRef<GpsFix | null>(null);

  const location = useMemo(
    () => (fixtureGps ? createFixtureLocationSource() : createExpoLocationSource()),
    [fixtureGps],
  );

  useEffect(() => {
    if (!running) return;
    const fail = (e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
      setRunning(false);
    };

    motionDetector.reset();
    latestFix.current = null;
    const addEvent = (e: DraftEvent) => setEvents((prev) => [e, ...prev].slice(0, MAX_EVENTS));
    const unsubs = [motionDetector.subscribe(addEvent), phoneUse.subscribe(addEvent)];
    phoneUse.start({ lockEnabled: false, getLatestFix: () => latestFix.current });

    location
      .start((fx) => {
        latestFix.current = fx;
        motionDetector.onGps(fx);
        setFix(fx);
      })
      .catch(fail);

    // Throttle re-renders to ~10 Hz; the source still runs at 50 Hz.
    let last = 0;
    let count = 0;
    let windowStart = Date.now();
    motionSource
      .start((s) => {
        motionDetector.onMotion(s);
        count++;
        if (s.t - windowStart >= 1000) {
          setHz((count * 1000) / (s.t - windowStart));
          count = 0;
          windowStart = s.t;
        }
        if (s.t - last > 100) {
          last = s.t;
          setSample(s);
        }
      })
      .catch(fail);

    return () => {
      motionSource.stop();
      location.stop();
      phoneUse.stop();
      for (const u of unsubs) u();
    };
  }, [running, motionSource, motionDetector, phoneUse, location]);

  const g = sample ? Math.hypot(sample.accG.x, sample.accG.y, sample.accG.z) : null;

  return (
    <ScrollView>
      <Text>WS1 Motion detection</Text>
      <Button
        title={running ? 'Stop' : 'Start'}
        onPress={() => {
          setError(null);
          setRunning((r) => !r);
        }}
      />
      <Button
        title={`GPS: ${fixtureGps ? 'fixture replay' : 'real (WS2)'} (tap to switch)`}
        disabled={running}
        onPress={() => setFixtureGps((v) => !v)}
      />
      {error && <Text>Error: {error}</Text>}

      <Text>--- Motion ---</Text>
      {hz !== null && <Text>Sample rate: {hz.toFixed(1)} Hz (expect ≈ 50)</Text>}
      {sample && (
        <View>
          <Text>
            acc (m/s²): {f(sample.acc.x)} {f(sample.acc.y)} {f(sample.acc.z)}
          </Text>
          <Text>
            accG (m/s²): {f(sample.accG.x)} {f(sample.accG.y)} {f(sample.accG.z)}
          </Text>
          <Text>|accG|: {g !== null ? f(g) : '-'} (expect ≈ 9.81 when still)</Text>
          <Text>
            rot (rad/s): {f(sample.rot.x)} {f(sample.rot.y)} {f(sample.rot.z)}
          </Text>
          <Text>
            (still phone: rot ≈ 0; one slow turn per second on the table ≈ 6.28 on the up axis)
          </Text>
        </View>
      )}
      <Text>Detector paused (junk rejection): {String(motionDetector.isPaused())}</Text>

      <Text>--- GPS ---</Text>
      {fix ? (
        <View>
          <Text>speed: {fix.speedMps === null ? '-' : `${f(fix.speedMps * MPS_TO_MPH)} mph`}</Text>
          <Text>accuracy: {fix.accuracyM === null ? '-' : `${f(fix.accuracyM)} m`}</Text>
          <Text>heading: {fix.heading === null ? '-' : `${f(fix.heading)}°`}</Text>
          <Text>
            at: {fix.lat.toFixed(5)}, {fix.lon.toFixed(5)} ({new Date(fix.t).toLocaleTimeString()})
          </Text>
        </View>
      ) : (
        <Text>No fix yet</Text>
      )}

      <Text>--- Events (newest first, lock off rules) ---</Text>
      <Button title="Report touch (phone use test)" onPress={() => phoneUse.reportTouch()} />
      <Button title="Clear events" onPress={() => setEvents([])} />
      {events.length === 0 && <Text>None yet</Text>}
      {events.map((e) => (
        <Text key={`${e.type}-${e.at}`}>
          {new Date(e.at).toLocaleTimeString()} {e.type} {e.tier}
          {e.peak !== null ? ` peak ${f(e.peak)} m/s²` : ''} {f(e.durationS)} s {f(e.speedMph)} mph
        </Text>
      ))}
    </ScrollView>
  );
}
