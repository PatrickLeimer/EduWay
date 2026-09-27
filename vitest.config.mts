/**
 * One Vitest run for the whole repo (`npm test`), split into projects.
 * Mobile tests cover pure logic only and run in Node: never import react-native
 * or expo-* from a file under test (keep those in thin adapter files).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'shared', include: ['packages/shared/src/**/*.test.ts'] } },
      { test: { name: 'fixtures', include: ['fixtures/**/*.test.ts'] } },
      { test: { name: 'mobile', include: ['apps/mobile/src/**/*.test.ts'] } },
      { test: { name: 'server', include: ['server/src/**/*.test.ts'] } },
      { test: { name: 'scripts', include: ['scripts/**/*.test.ts'] } },
    ],
  },
});
