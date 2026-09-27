/**
 * Screen-on lock for a drive (master doc §4). Thin adapter over expo-keep-awake.
 * Lazy require so Vitest can load trip/ without pulling in Expo (not `import()`,
 * which Metro splits into a bundle that can fail HMR registration on native).
 *
 * Docs (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/keep-awake/
 */
const TAG = 'edudriver-trip';

export interface KeepAwake {
  activate(): Promise<void>;
  deactivate(): Promise<void>;
}

function loadKeepAwake(): typeof import('expo-keep-awake') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy, see above
  return require('expo-keep-awake') as typeof import('expo-keep-awake');
}

export function createExpoKeepAwake(): KeepAwake {
  return {
    async activate() {
      await loadKeepAwake().activateKeepAwakeAsync(TAG);
    },
    async deactivate() {
      await loadKeepAwake().deactivateKeepAwake(TAG);
    },
  };
}
