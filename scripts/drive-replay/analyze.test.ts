import { HARD_BRAKE, type DraftEvent, type GpsFix, type MotionSample } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import {
  RECORDING_VERSION,
  type MarkerType,
  type Recording,
} from '../../apps/mobile/src/recorder/format';

import {
  applyOverrides,
  formatReport,
  replay,
  score,
  thresholdDrift,
  type ReplayedEvent,
} from './analyze';

const START = 1_700_000_000_000;

function recording(opts: {
  samples?: MotionSample[];
  fixes?: GpsFix[];
  markers?: [number, MarkerType][];
}): Recording {
  return {
    header: {
      k: 'header',
      v: RECORDING_VERSION,
      startedAt: new Date(START).toISOString(),
      startMs: START,
      platform: 'ios',
      osVersion: '18.0',
      mount: 'mounted',
      thresholds: {},
    },
    samples: opts.samples ?? [],
    gps: (opts.fixes ?? []).map((fix) => ({ k: 'gps', rt: fix.t - START, fix })),
    events: [],
    markers: (opts.markers ?? []).map(([rt, marker]) => ({ k: 'marker', rt, marker })),
    segments: [{ k: 'segment', rt: 0, segment: 'parking_lot' }],
    overpass: [],
    app: [],
    durationMs: 40_000,
    complete: true,
    badLines: 0,
  };
}

/**
 * Phone flat and still for 40 s at 50 Hz, except a longitudinal push of
 * `accel` m/s² between `from` and `to` seconds. GPS at 1 Hz, 15 m/s, slowing
 * by 3 m/s per second from `slowFrom` s.
 */
function drive(pushes: { from: number; to: number; accel: number }[], slowFrom: number) {
  const samples: MotionSample[] = [];
  for (let ms = 0; ms < 40_000; ms += 20) {
    const push = pushes.find((p) => ms >= p.from * 1000 && ms < p.to * 1000);
    samples.push({
      t: START + ms,
      acc: { x: push?.accel ?? 0, y: 0, z: 0 },
      accG: { x: push?.accel ?? 0, y: 0, z: -9.81 },
      rot: { x: 0, y: 0, z: 0 },
    });
  }
  const fixes: GpsFix[] = [];
  for (let s = 0; s <= 40; s++) {
    const speed = s < slowFrom ? 15 : Math.max(2, 15 - 3 * (s - slowFrom + 1));
    fixes.push({
      t: START + s * 1000,
      lat: 25.76,
      lon: -80.37,
      speedMps: speed,
      heading: 0,
      accuracyM: 5,
    });
  }
  return { samples, fixes };
}

function ev(type: DraftEvent['type'], peakRt: number, rt = peakRt + 500): ReplayedEvent {
  return {
    rt,
    peakRt,
    source: 'motion',
    road: null,
    event: {
      type,
      tier: 'coach',
      peak: 3,
      durationS: 0.5,
      speedMph: 20,
      at: new Date(START + peakRt).toISOString(),
      location: { type: 'Point', coordinates: [-80.37, 25.76] },
    },
  };
}

describe('drive replay', () => {
  it('re-detects a hard brake from raw samples and credits the marker', async () => {
    // Hard brake 11–12.5 s while GPS speed drops; gentle brake 30–31 s.
    const { samples, fixes } = drive(
      [
        { from: 11, to: 12.5, accel: 6 },
        { from: 30, to: 31, accel: 1 },
      ],
      10,
    );
    const rec = recording({
      samples,
      fixes,
      markers: [
        [13_000, 'hard_brake'],
        [32_000, 'normal_brake'],
      ],
    });
    const r = await replay(rec);
    const brakes = r.events.filter((e) => e.event.type === 'hard_brake');
    expect(brakes).toHaveLength(1);
    expect(brakes[0]!.event.tier).toBe('harsh');
    expect(brakes[0]!.peakRt).toBeGreaterThan(11_000);
    expect(brakes[0]!.peakRt).toBeLessThan(12_600);

    const s = score(rec, r.events);
    expect(s.markers.map((m) => [m.marker.marker, m.passed])).toEqual([
      ['hard_brake', true],
      ['normal_brake', true],
    ]);
    expect(s.events.find((e) => e.event.type === 'hard_brake')?.verdict).toBe('confirmed');

    const report = formatReport({
      rec,
      replay: r,
      scoring: s,
      fileName: 'test.ndjson',
      overrides: [],
      thresholdDrift: [],
    });
    expect(report).toContain('1. Recording health');
    expect(report).toMatch(/gravity \|accG\| median 9\.8/);
    expect(report).toMatch(/hard_brake\s+1\s+1\s+0\s+1\s+1\s+0\s+0/);
    expect(report).toContain('Hard brake (1): brake m/s²');
  });

  it('misses the brake once the threshold is raised above it', async () => {
    const { samples, fixes } = drive([{ from: 11, to: 12.5, accel: 6 }], 10);
    const rec = recording({ samples, fixes, markers: [[13_000, 'hard_brake']] });
    const original = HARD_BRAKE.coach.start;
    const restore = applyOverrides(['HARD_BRAKE.coach.start=7', 'HARD_BRAKE.harsh.start=8']);
    try {
      expect(HARD_BRAKE.coach.start).toBe(7);
      const r = await replay(rec);
      expect(r.events.filter((e) => e.event.type === 'hard_brake')).toHaveLength(0);
      expect(score(rec, r.events).markers[0]!.passed).toBe(false);
    } finally {
      restore();
    }
    expect(HARD_BRAKE.coach.start).toBe(original);
  });

  it('scores false alarms from "normal" markers and the "App was wrong" button', () => {
    const rec = recording({
      markers: [
        [10_000, 'normal_turn'],
        [20_000, 'false_alarm'],
        [30_000, 'sharp_turn'],
      ],
    });
    const s = score(rec, [
      ev('rough_turn', 9_000), // during a normal turn → false alarm
      ev('hard_brake', 18_000), // flagged by "App was wrong"
      ev('rough_turn', 29_000), // expected → confirmed
      ev('swerve', 35_000), // nothing nearby → unconfirmed
    ]);
    expect(s.events.map((e) => e.verdict)).toEqual([
      'false_alarm',
      'false_alarm',
      'confirmed',
      'unconfirmed',
    ]);
    expect(s.markers.map((m) => m.passed)).toEqual([false, null, true]);
  });

  it('rejects bad overrides and reports threshold drift', () => {
    expect(() => applyOverrides(['HARD_BRAKE.coach.start=abc'])).toThrow(/Bad --set/);
    expect(() => applyOverrides(['NOPE.x=1'])).toThrow(/Unknown threshold group/);
    expect(() => applyOverrides(['HARD_BRAKE.coach=1'])).toThrow(/not a number/);

    const rec = recording({});
    rec.header.thresholds = {
      HARD_BRAKE: { ...HARD_BRAKE, coach: { ...HARD_BRAKE.coach, start: 9 } },
    };
    expect(thresholdDrift(rec)).toEqual(['HARD_BRAKE']);
  });
});
