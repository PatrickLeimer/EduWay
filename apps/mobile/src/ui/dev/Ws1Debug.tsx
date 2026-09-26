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
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    // Throttle re-renders to ~10 Hz; the source still runs at 50 Hz.
    let last = 0;
    void modules.motionSource.start((s) => {
      if (s.t - last > 100) {
        last = s.t;
        setSample(s);
      }
    });
    return () => modules.motionSource.stop();
  }, [running, modules.motionSource]);

  const g = sample ? Math.hypot(sample.accG.x, sample.accG.y, sample.accG.z) : null;

  return (
    <View>
      <Text>WS1 Motion detection</Text>
      <Button
        title={running ? 'Stop sensors' : 'Start sensors'}
        onPress={() => setRunning((r) => !r)}
      />
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
        </>
      )}
      <Text>Detector paused (junk rejection): {String(modules.motionDetector.isPaused())}</Text>
    </View>
  );
}
