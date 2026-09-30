// Pure clip id mapping, plus drift checks between the clip manifest, the bundled
// mp3s, and AlertPlayer's hand-written require map. Cooldown tests live in cooldown.test.ts.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LiveAlertTypeSchema } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { clipIdFor, SPEED_LIMIT_CLIPS_MPH } from './clips';

describe('clipIdFor', () => {
  it('maps alert types to clip ids', () => {
    expect(clipIdFor('hard_brake')).toBe('hard_brake');
    expect(clipIdFor('speeding', 30)).toBe('speeding_30');
    // Never announce a limit we do not have a clip for; fall back to the generic clip.
    expect(clipIdFor('speeding', 50)).toBe('speeding');
    expect(clipIdFor('speeding', null)).toBe('speeding');
  });
});

describe('bundled clips', () => {
  const manifest = JSON.parse(
    readFileSync(join(__dirname, '../../../../scripts/alert-clips/clips.manifest.json'), 'utf8'),
  ) as { clips: { id: string }[] };
  const manifestIds = manifest.clips.map((c) => c.id);
  const playerSource = readFileSync(join(__dirname, 'AlertPlayer.ts'), 'utf8');
  const requiredIds = [
    ...playerSource.matchAll(/(\w+): require\('\.\.\/\.\.\/assets\/alerts\/(\w+)\.mp3'\)/g),
  ].map(([, key, file]) => {
    expect(key).toBe(file);
    return key;
  });

  it('every clip the app can ask for is in the manifest', () => {
    const reachable = [
      ...LiveAlertTypeSchema.options.map((t) => clipIdFor(t)),
      ...SPEED_LIMIT_CLIPS_MPH.map((mph) => clipIdFor('speeding', mph)),
    ];
    expect(manifestIds).toEqual(expect.arrayContaining(reachable));
  });

  it('every manifest clip has a generated mp3', () => {
    for (const id of manifestIds) {
      expect(existsSync(join(__dirname, `../../assets/alerts/${id}.mp3`)), id).toBe(true);
    }
  });

  it("AlertPlayer's require map matches the manifest exactly", () => {
    expect([...requiredIds].sort()).toEqual([...manifestIds].sort());
  });
});
