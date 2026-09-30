/**
 * Real MotionSource over expo-sensors DeviceMotion (WS1).
 *
 * This is the only file in detection/ allowed to import Expo. Keep it thin:
 * permissions, subscription, unit conversion. All math lives in pure files
 * (unit and axis conversion: deviceMotion.ts).
 *
 * Docs (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/devicemotion/
 */
import { PIPELINE, type MotionSample } from '@eduway/shared';
import { DeviceMotion } from 'expo-sensors';
import { Platform } from 'react-native';

import type { MotionSource } from '../contracts';

import { toMotionSample } from './deviceMotion';

export function createExpoMotionSource(): MotionSource {
  let subscription: { remove(): void } | null = null;

  return {
    async start(onSample: (sample: MotionSample) => void) {
      if (subscription) return;
      if (!(await DeviceMotion.isAvailableAsync())) {
        throw new Error('DeviceMotion is not available on this device');
      }
      const { granted } = await DeviceMotion.requestPermissionsAsync();
      if (!granted) throw new Error('Motion permission denied');

      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      DeviceMotion.setUpdateInterval(PIPELINE.motionIntervalMs);
      subscription = DeviceMotion.addListener((m) => {
        // Date.now() (not the sensor's boot-relative timestamp) so samples line up with GPS fixes.
        const sample = toMotionSample(m, platform, Date.now());
        if (sample) onSample(sample);
      });
    },
    stop() {
      subscription?.remove();
      subscription = null;
    },
  };
}
