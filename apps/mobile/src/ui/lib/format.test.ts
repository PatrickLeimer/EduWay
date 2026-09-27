import { describe, expect, it } from 'vitest';

import { clockText, durationText, secondsBetween, speedMphText, totalEvents } from './format';

describe('speedMphText', () => {
  it('converts m/s to whole mph', () => {
    expect(speedMphText(13.4112)).toBe('30');
  });
  it('shows -- when speed is unknown', () => {
    expect(speedMphText(null)).toBe('--');
    expect(speedMphText(undefined)).toBe('--');
  });
  it('never shows negative speed', () => {
    expect(speedMphText(-1)).toBe('0');
  });
});

describe('clockText', () => {
  it('formats minutes and hours', () => {
    expect(clockText(42)).toBe('0:42');
    expect(clockText(725)).toBe('12:05');
    expect(clockText(3729)).toBe('1:02:09');
  });
});

describe('durationText', () => {
  it('rounds to minutes', () => {
    expect(durationText(20)).toBe('<1 min');
    expect(durationText(24 * 60)).toBe('24 min');
    expect(durationText(65 * 60)).toBe('1 h 5 min');
  });
});

describe('secondsBetween', () => {
  it('returns the gap in seconds, never negative', () => {
    expect(secondsBetween('2026-09-26T10:00:00.000Z', '2026-09-26T10:01:30.000Z')).toBe(90);
    expect(secondsBetween('2026-09-26T10:01:30.000Z', '2026-09-26T10:00:00.000Z')).toBe(0);
  });
});

describe('totalEvents', () => {
  it('sums every count', () => {
    expect(
      totalEvents({
        brake: 1,
        accel: 2,
        turn: 0,
        swerve: 1,
        speeding: 3,
        rollingStop: 0,
        phoneUse: 1,
      }),
    ).toBe(8);
  });
});
