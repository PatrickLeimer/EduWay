// Placeholder test: the clip manifest is valid and ids are unique.
import { describe, expect, it } from 'vitest';

import { SPEED_LIMIT_CLIPS_MPH } from '../../apps/mobile/src/voice/clips';

import { loadManifest } from './generate';

describe('alert clip manifest', () => {
  it('parses and has unique ids', () => {
    const { clips } = loadManifest();
    expect(new Set(clips.map((c) => c.id)).size).toBe(clips.length);
    expect(clips.map((c) => c.id)).toEqual(
      expect.arrayContaining(['hard_brake', 'rough_turn', 'swerve', 'phone_use', 'speeding']),
    );
  });

  it('has a clip for every speed limit the app can announce', () => {
    const ids = new Set(loadManifest().clips.map((c) => c.id));
    for (const mph of SPEED_LIMIT_CLIPS_MPH) expect(ids.has(`speeding_${mph}`)).toBe(true);
  });
});
