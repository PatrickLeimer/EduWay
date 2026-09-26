/**
 * Real MotionSource over expo-sensors DeviceMotion (WS1). STUB.
 *
 * This is the only file in detection/ allowed to import Expo. Keep it thin:
 * permissions, subscription, unit conversion. All math lives in pure files.
 *
 * Docs (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/devicemotion/
 * - acceleration / accelerationIncludingGravity are m/s²
 * - rotationRate is deg/s → convert with DEG_TO_RAD (contract expects rad/s)
 */
import type { MotionSample } from '@edudriver/shared';

import type { MotionSource } from '../contracts';

export function createExpoMotionSource(): MotionSource {
  return {
    async start(_onSample: (sample: MotionSample) => void) {
      // TODO(WS1, §5): DeviceMotion.requestPermissionsAsync();
      //   DeviceMotion.setUpdateInterval(PIPELINE.motionIntervalMs);
      //   DeviceMotion.addListener(m => onSample({ t: Date.now(), acc, accG, rot: deg→rad })).
      // TODO(WS1, §5 "Check units first"): verify on a still phone that |accG| ≈ 9.8.
      console.warn('[detection] expoMotionSource is a stub; no samples will be produced');
    },
    stop() {
      // TODO(WS1): remove the DeviceMotion subscription.
    },
  };
}
