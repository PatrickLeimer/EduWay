/**
 * WS1 debug screen (owned by WS1). Live motion readings for the §14 Friday goal:
 * "Live readings on screen; units verified" (|accG| ≈ 9.8 m/s² on a still phone).
 */
import type { MotionSample } from '@edudriver/shared';
import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';

import type { ScreenProps } from '../navigation';

const f = (n: number) => n.toFixed(2);

export function Ws1Debug({ modules }: ScreenProps) {
  const [sample, setSample] = useState<MotionSample | null>(null);
  const [hz, setHz] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    setError(null);
    // Throttle re-renders to ~10 Hz; the source still runs at 50 Hz.
    let last = 0;
    let count = 0;
    let windowStart = Date.now();
    modules.motionSource
      .start((s) => {
        // Feed the detector too, so the junk-rejection line below is live.
        modules.motionDetector.onMotion(s);
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
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setRunning(false);
      });
    return () => modules.motionSource.stop();
  }, [running, modules.motionSource, modules.motionDetector]);

  const g = sample ? Math.hypot(sample.accG.x, sample.accG.y, sample.accG.z) : null;

  return (
    <View>
      <Text>WS1 Motion detection</Text>
      <Button
        title={running ? 'Stop sensors' : 'Start sensors'}
        onPress={() => setRunning((r) => !r)}
      />
      {error && <Text>Error: {error}</Text>}
      {hz !== null && <Text>Sample rate: {hz.toFixed(1)} Hz (expect ≈ 50)</Text>}
      {sample && (
        <>
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
        </>
      )}
      <Text>Detector paused (junk rejection): {String(modules.motionDetector.isPaused())}</Text>
    </View>
  );
}
