// Placeholder test: proves Vitest runs pure mobile logic. WS1 adds detector tests next to it.
import { describe, expect, it } from 'vitest';

import { cross, dot, ema, len, norm, sub, vec } from './vector';

describe('vector helpers', () => {
  it('computes dot, len and norm', () => {
    expect(dot(vec(1, 2, 3), vec(4, 5, 6))).toBe(32);
    expect(len(vec(3, 4, 0))).toBe(5);
    expect(norm(vec(0, 0, 9.81))).toEqual(vec(0, 0, 1));
    expect(norm(vec(0, 0, 0))).toEqual(vec(0, 0, 0));
  });

  it('removes the gravity component (§6 horizontal acceleration)', () => {
    const up = vec(0, 0, 1);
    const a = vec(2, 0, 5);
    const h = sub(a, { x: 0, y: 0, z: dot(a, up) });
    expect(h).toEqual(vec(2, 0, 0));
    expect(cross(up, vec(1, 0, 0))).toEqual(vec(0, 1, 0));
  });

  it('steps an EMA', () => {
    expect(ema(0, 10, 0.2)).toBeCloseTo(2);
  });
});
