import { COACH } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { pickMainProblem, type PatternEvent } from './mainProblem';

const trip = (
  type: PatternEvent['type'],
  tripId: string,
  street: string | null = 'Main St',
): PatternEvent => ({
  type,
  tripId,
  street,
});

/** Three trips of one type, one event each, unless extra events are passed. */
function tripsOf(
  type: PatternEvent['type'],
  count: number,
  street: string | null = 'Main St',
): PatternEvent[] {
  return Array.from({ length: count }, (_, i) => trip(type, `t${i + 1}`, street));
}

describe('pickMainProblem', () => {
  it('returns null until one type has happened on enough distinct trips', () => {
    const short = tripsOf('hard_brake', COACH.mainProblemMinTrips - 1);
    expect(pickMainProblem(short)).toBeNull();
    expect(pickMainProblem([])).toBeNull();
  });

  it('counts a trip once no matter how many events it has', () => {
    const events = [
      ...tripsOf('hard_brake', COACH.mainProblemMinTrips),
      trip('hard_brake', 't1', 'Main St'),
      trip('hard_brake', 't1', 'Main St'),
    ];
    expect(pickMainProblem(events)).toEqual({
      type: 'hard_brake',
      trip_count: COACH.mainProblemMinTrips,
      street: 'Main St',
    });
  });

  it('picks the type that shows up on the most trips', () => {
    const events = [
      ...tripsOf('speeding', COACH.mainProblemMinTrips),
      ...tripsOf('hard_brake', COACH.mainProblemMinTrips + 1),
    ];
    expect(pickMainProblem(events)?.type).toBe('hard_brake');
    expect(pickMainProblem(events)?.trip_count).toBe(COACH.mainProblemMinTrips + 1);
  });

  it('breaks a tie with the safety order, phone use first', () => {
    const events = [
      ...tripsOf('rolling_stop', COACH.mainProblemMinTrips),
      ...tripsOf('phone_use', COACH.mainProblemMinTrips, 'Oak Ave'),
      ...tripsOf('hard_brake', COACH.mainProblemMinTrips),
    ];
    expect(pickMainProblem(events)).toMatchObject({ type: 'phone_use', street: 'Oak Ave' });
  });

  it('names a street only when that street repeats on enough trips', () => {
    const onceEach = [
      trip('hard_brake', 't1', 'First St'),
      trip('hard_brake', 't2', 'Second St'),
      trip('hard_brake', 't3', 'Third St'),
    ];
    expect(pickMainProblem(onceEach)?.street).toBeNull();

    const repeated = [...onceEach, trip('hard_brake', 't4', 'Second St')];
    expect(pickMainProblem(repeated)).toEqual({
      type: 'hard_brake',
      trip_count: 4,
      street: 'Second St',
    });
  });

  it('skips a missing street and the unnamed-road placeholder', () => {
    const events = [
      trip('hard_brake', 't1', null),
      trip('hard_brake', 't2', '  '),
      trip('hard_brake', 't3', 'an unnamed road'),
      trip('speeding', 't1', 'an unnamed road'),
      trip('speeding', 't2', 'an unnamed road'),
      trip('speeding', 't3', null),
    ];
    expect(pickMainProblem(events)).toEqual({
      type: 'hard_brake',
      trip_count: 3,
      street: null,
    });
  });

  it('picks the street with the most trips, then the earlier name', () => {
    const events = [
      trip('swerve', 't1', 'Zebra Rd'),
      trip('swerve', 't2', 'Zebra Rd'),
      trip('swerve', 't3', 'Alpha Rd'),
      trip('swerve', 't4', 'Alpha Rd'),
    ];
    expect(pickMainProblem(events)?.street).toBe('Alpha Rd');

    const moreOnZebra = [...events, trip('swerve', 't5', 'Zebra Rd')];
    expect(pickMainProblem(moreOnZebra)?.street).toBe('Zebra Rd');
  });
});
