import { MPS_TO_MPH, PHONE_USE, PIPELINE, type GpsFix } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { createPhoneUseTracker } from './phoneUse';

const T0 = Date.UTC(2026, 8, 26, 14, 0, 0);

const fixAt = (speedMps: number | null): GpsFix => ({
  t: T0,
  lat: 25.76,
  lon: -80.19,
  speedMps,
  heading: 90,
  accuracyM: 5,
});

/** A tracker whose latest fix the test can change. */
function setup(lockEnabled: boolean, speedMps: number | null = 15) {
  let fix: GpsFix | null = fixAt(speedMps);
  const tracker = createPhoneUseTracker({ lockEnabled, getLatestFix: () => fix });
  return {
    tracker,
    setFix: (f: GpsFix | null) => {
      fix = f;
    },
  };
}

describe('createPhoneUseTracker: touches', () => {
  it('emits a phone_use event right away for a touch while moving', () => {
    const { tracker } = setup(true);
    expect(tracker.onTouch(T0)).toEqual({
      type: 'phone_use',
      tier: 'harsh',
      peak: null,
      durationS: 0,
      speedMph: 15 * MPS_TO_MPH,
      at: new Date(T0).toISOString(),
      location: { type: 'Point', coordinates: [-80.19, 25.76] },
    });
  });

  it('ignores touches when stopped, slow, or without GPS', () => {
    expect(setup(false, 0).tracker.onTouch(T0)).toBeNull();
    expect(setup(false, PHONE_USE.minSpeedMps).tracker.onTouch(T0)).toBeNull();
    expect(setup(false, -1).tracker.onTouch(T0)).toBeNull();
    expect(setup(false, null).tracker.onTouch(T0)).toBeNull();
    const { tracker, setFix } = setup(false);
    setFix(null);
    expect(tracker.onTouch(T0)).toBeNull();
  });

  it('treats a burst of touches as one episode', () => {
    const { tracker } = setup(false);
    const gap = PIPELINE.mergeWindowS * 1000 - 500;
    expect(tracker.onTouch(T0)).not.toBeNull();
    expect(tracker.onTouch(T0 + gap)).toBeNull();
    expect(tracker.onTouch(T0 + 2 * gap)).toBeNull();
    // A pause longer than the merge window starts a new episode.
    expect(tracker.onTouch(T0 + 2 * gap + PIPELINE.mergeWindowS * 1000)).not.toBeNull();
  });
});

describe('createPhoneUseTracker: leaving the app', () => {
  it('lock off: emits on return with the time away', () => {
    const { tracker, setFix } = setup(false);
    expect(tracker.onAppState('background', T0)).toBeNull();
    setFix(fixAt(20));
    const e = tracker.onAppState('active', T0 + 12_000);
    // Location and speed from when the student left.
    expect(e).toMatchObject({
      type: 'phone_use',
      durationS: 12,
      at: new Date(T0).toISOString(),
      speedMph: 15 * MPS_TO_MPH,
    });
  });

  it('lock off: ignores leaving the app while stopped', () => {
    const { tracker } = setup(false, 0);
    tracker.onAppState('background', T0);
    expect(tracker.onAppState('active', T0 + 12_000)).toBeNull();
  });

  it('ignores the inactive state (notification shade, control centre)', () => {
    const { tracker } = setup(false);
    tracker.onAppState('inactive', T0);
    expect(tracker.onAppState('active', T0 + 2000)).toBeNull();
  });

  it('lock on: leaving the app (emergency, navigation, music) is not phone use', () => {
    const { tracker } = setup(true);
    tracker.onAppState('background', T0);
    expect(tracker.onAppState('active', T0 + 12_000)).toBeNull();
  });

  it('merges touches right after returning into the same episode', () => {
    const { tracker } = setup(false);
    tracker.onAppState('background', T0);
    expect(tracker.onAppState('active', T0 + 10_000)).not.toBeNull();
    expect(tracker.onTouch(T0 + 11_000)).toBeNull();
  });

  it('lock off: opening navigation or an emergency call is not phone use', () => {
    const { tracker } = setup(false);
    tracker.onSafeExit();
    tracker.onAppState('inactive', T0);
    expect(tracker.onAppState('background', T0 + 500)).toBeNull();
    expect(tracker.onAppState('active', T0 + 60_000)).toBeNull();
    expect(tracker.close(T0 + 61_000)).toBeNull();
  });

  it('a safe exit only excuses the next trip to the background', () => {
    const { tracker } = setup(false);
    tracker.onSafeExit();
    tracker.onAppState('background', T0);
    tracker.onAppState('active', T0 + 30_000);
    tracker.onAppState('background', T0 + 40_000);
    expect(tracker.onAppState('active', T0 + 50_000)).toMatchObject({ durationS: 10 });
  });

  it('an in-app touch drops an unused safe exit (the link did not open)', () => {
    const { tracker } = setup(false);
    tracker.onSafeExit();
    expect(tracker.onTouch(T0)).not.toBeNull();
    tracker.onAppState('background', T0 + 10_000);
    expect(tracker.onAppState('active', T0 + 20_000)).toMatchObject({ durationS: 10 });
  });

  it('close emits an episode still open at trip end', () => {
    const { tracker } = setup(false);
    tracker.onAppState('background', T0);
    expect(tracker.close(T0 + 5000)?.durationS).toBe(5);
    expect(tracker.close(T0 + 6000)).toBeNull();
  });
});
