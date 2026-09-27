// Placeholder test for the shared package: sanity rules the team relies on.
import { describe, expect, it } from 'vitest';

import { EVENT_TYPES } from './types';
import { COACH, HARD_BRAKE, ROUGH_TURN, SCORING, SPEEDING, SWERVE } from './thresholds';

describe('thresholds', () => {
  it('harsh tiers are stricter than coach tiers', () => {
    expect(HARD_BRAKE.harsh.start).toBeGreaterThan(HARD_BRAKE.coach.start);
    expect(ROUGH_TURN.harsh.start).toBeGreaterThan(ROUGH_TURN.coach.start);
    expect(SWERVE.harsh.peakMps2).toBeGreaterThan(SWERVE.coach.peakMps2);
    expect(SPEEDING.harshOverMph).toBeGreaterThan(SPEEDING.coachOverMph);
  });

  it('release thresholds sit below start thresholds (hysteresis)', () => {
    for (const t of [HARD_BRAKE.coach, HARD_BRAKE.harsh, ROUGH_TURN.coach, ROUGH_TURN.harsh]) {
      expect(t.release).toBeLessThan(t.start);
    }
  });

  it('breaks main-problem ties in an order that covers every event type once', () => {
    expect(new Set(COACH.mainProblemTieBreak)).toEqual(new Set(EVENT_TYPES));
    expect(COACH.mainProblemTieBreak).toHaveLength(EVENT_TYPES.length);
    expect(COACH.mainProblemMinTrips).toBeGreaterThan(COACH.mainProblemStreetMinTrips);
  });

  it('has a penalty for every event type, with phone use heaviest (§7)', () => {
    const maxOther = Math.max(
      ...EVENT_TYPES.filter((t) => t !== 'phone_use').map((t) => SCORING.penalty[t].harsh),
    );
    expect(SCORING.penalty.phone_use.harsh).toBeGreaterThan(maxOther);
  });
});
