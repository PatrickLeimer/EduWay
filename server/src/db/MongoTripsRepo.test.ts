// Integration test against a real MongoDB (Atlas). Opt-in so `npm test` stays offline:
//   RUN_MONGO_TESTS=true npm test
// Uses MONGODB_URI from server/.env and a throwaway "<MONGODB_DB>_test" database, dropped after.
import { fileURLToPath } from 'node:url';

import { eventsFixture, traceFixture, tripFixture } from '@edudriver/fixtures';
import {
  GetProgressResponseSchema,
  GetTripResponseSchema,
  TraceSchema,
  TripListItemSchema,
  TripSummarySchema,
} from '@edudriver/shared';
import { config as loadEnv } from 'dotenv';
import type { Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDb, connectDb } from './client';
import { createMongoTripsRepo } from './MongoTripsRepo';
import { ensureCollectionsAndIndexes } from './setup';

loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
const uri = process.env.MONGODB_URI;
const enabled = process.env.RUN_MONGO_TESTS === 'true' && !!uri;

describe.skipIf(!enabled)('MongoTripsRepo (live MongoDB)', () => {
  let db: Db;
  const userId = `test-user-${Date.now()}`;
  const { _id: _i, coach: _c, coachAudioUrl: _a, ...trip } = tripFixture;
  const { tripId: _t, userId: _u, ...trace } = traceFixture;
  const input = { trip: { ...trip, userId }, events: eventsFixture, trace };

  beforeAll(async () => {
    db = await connectDb(uri!, `${process.env.MONGODB_DB ?? 'edudriver'}_test`);
    await ensureCollectionsAndIndexes(db, () => {});
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await closeDb();
  });

  it('inserts a trip and reads back trip, events and trace', async () => {
    const repo = createMongoTripsRepo(db);
    const { trip: saved, events } = await repo.insertTrip(input);
    expect(saved._id).toMatch(/^[0-9a-f]{24}$/);
    expect(events).toHaveLength(eventsFixture.length);

    const loaded = await repo.getTrip(saved._id);
    expect(GetTripResponseSchema.parse(loaded).events).toHaveLength(eventsFixture.length);
    expect(loaded?.trip.startedAt).toBe(trip.startedAt);

    const loadedTrace = TraceSchema.parse(await repo.getTrace(saved._id));
    expect(loadedTrace.tripId).toBe(saved._id);
    expect(loadedTrace.lat).toEqual(trace.lat);

    expect(await repo.getTrip('nope')).toBeNull();
    expect(await repo.getTrace('0123456789abcdef01234567')).toBeNull();
  });

  it('lists newest first without coach/stats and stores coaching', async () => {
    const repo = createMongoTripsRepo(db);
    const later = new Date(Date.parse(trip.startedAt) + 86_400_000).toISOString();
    const { trip: second } = await repo.insertTrip({
      ...input,
      trip: { ...input.trip, startedAt: later, endedAt: later },
    });

    const list = await repo.listTrips(userId);
    expect(list[0]?._id).toBe(second._id);
    for (const item of list) expect(TripListItemSchema.strict().parse(item)).toBeTruthy();

    const coach = { strengths: ['Smooth turns'], focus_areas: [], debrief_script: 'Nice.' };
    await repo.setCoaching(second._id, coach, 'https://example.com/a.mp3');
    const loaded = await repo.getTrip(second._id);
    expect(loaded?.trip.coach).toEqual(coach);
    expect(loaded?.trip.coachAudioUrl).toBe('https://example.com/a.mp3');
  });

  it('getHistory returns past scores and recurring spots across trips', async () => {
    const repo = createMongoTripsRepo(db);
    // The same fixture route driven again: every event location repeats on every trip.
    const { trip: latest } = await repo.insertTrip(input);
    const history = await repo.getHistory(userId, latest._id);

    TripSummarySchema.shape.history.parse(history);
    expect(history.last_5_scores).toHaveLength(2);
    expect(history.recurring_spots.length).toBeGreaterThan(0);
    expect(history.recurring_spots.every((s) => s.count === 3)).toBe(true);
    // Three copies of the fixture tie on every type; phone use wins the tie.
    expect(history.main_problem).toEqual({
      type: 'phone_use',
      trip_count: 3,
      street: 'SW 8th St',
    });
  });

  it('getProgress and listGamificationTrips from stored trips (no traces)', async () => {
    const repo = createMongoTripsRepo(db);
    // Three fixture drives exist by now (previous tests), all 1.27 mi and not passenger.
    const progress = GetProgressResponseSchema.parse(await repo.getProgress(userId));
    expect(progress.scores).toHaveLength(3);
    expect(progress.qualifyingTrips).toHaveLength(3);
    expect(progress.userProgress.qualifyingTrips).toBe(3);
    expect(progress.userProgress.tier).not.toBe('rookie');
    // Every fixture event repeats on every trip, so each type sums to 3x the fixture count.
    const brakes = eventsFixture.filter((e) => e.type === 'hard_brake').length;
    expect(progress.skills.hard_brake.count).toBe(brakes * 3);
    expect(progress.recurringSpots.length).toBeGreaterThan(0);
    expect(progress.recurringSpots.every((s) => s.count === 3)).toBe(true);

    const gam = await repo.listGamificationTrips(userId);
    expect(gam).toHaveLength(3);
    const harsh = eventsFixture.filter((e) => e.tier === 'harsh').length;
    expect(gam.every((t) => t.harshEvents === harsh)).toBe(true);

    // A user with no trips is a rookie, not an error.
    const empty = GetProgressResponseSchema.parse(await repo.getProgress(`${userId}-none`));
    expect(empty.userProgress.tier).toBe('rookie');
  });
});
