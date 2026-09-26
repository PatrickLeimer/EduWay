// Pure clip id mapping. Cooldown tests live in cooldown.test.ts.
import { describe, expect, it } from 'vitest';

import { clipIdFor } from './clips';

describe('clipIdFor', () => {
  it('maps alert types to clip ids', () => {
    expect(clipIdFor('hard_brake')).toBe('hard_brake');
    expect(clipIdFor('speeding', 30)).toBe('speeding_30');
    // Never announce a limit we do not have a clip for; fall back to the generic clip.
    expect(clipIdFor('speeding', 50)).toBe('speeding');
    expect(clipIdFor('speeding', null)).toBe('speeding');
  });
});
