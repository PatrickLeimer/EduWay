/**
 * Screen-on lock for a drive (master doc §4). Thin adapter over expo-keep-awake.
 * Dynamic import so Vitest can load trip/ without pulling in Expo.
 *
 * Docs (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/keep-awake/
 */
const TAG = 'edudriver-trip';

export interface KeepAwake {
  activate(): Promise<void>;
  deactivate(): Promise<void>;
}

export function createExpoKeepAwake(): KeepAwake {
  return {
    async activate() {
      const { activateKeepAwakeAsync } = await import('expo-keep-awake');
      await activateKeepAwakeAsync(TAG);
    },
    async deactivate() {
      const { deactivateKeepAwake } = await import('expo-keep-awake');
      await deactivateKeepAwake(TAG);
    },
  };
}
