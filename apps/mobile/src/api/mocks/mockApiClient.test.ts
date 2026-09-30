// Placeholder test: the mock API honors the shared response schemas.
import { traceFixture, eventsFixture } from '@eduway/fixtures';
import {
  CreateTripResponseSchema,
  DEMO_USER_ID,
  GetProgressResponseSchema,
  ListTripsResponseSchema,
  TraceUploadSchema,
} from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { encodeTrace } from '../traceCodec';

import { createMockApiClient } from '.';

describe('mock ApiClient', () => {
  it('creates a trip and lists it', async () => {
    const api = createMockApiClient(0);
    const res = await api.createTrip({
      userId: DEMO_USER_ID,
      trip: {
        startedAt: traceFixture.startedAt,
        endedAt: traceFixture.startedAt,
        distanceMi: 1,
        passenger: false,
        lockEnabled: true,
      },
      events: eventsFixture,
      traceGzipB64: encodeTrace(TraceUploadSchema.parse(traceFixture)),
    });
    expect(CreateTripResponseSchema.safeParse(res).success).toBe(true);

    const list = ListTripsResponseSchema.parse(await api.listTrips(DEMO_USER_ID));
    expect(list.trips[0]?._id).toBe(res.trip._id);
    expect(GetProgressResponseSchema.safeParse(await api.getProgress(DEMO_USER_ID)).success).toBe(
      true,
    );
  });

  it('returns a progressUpdate: tier-up and streak-broken samples, nothing for passengers', async () => {
    const api = createMockApiClient(0);
    const req = (passenger: boolean) => ({
      userId: DEMO_USER_ID,
      trip: {
        startedAt: traceFixture.startedAt,
        endedAt: traceFixture.startedAt,
        distanceMi: 3,
        passenger,
        lockEnabled: true,
      },
      events: eventsFixture,
      traceGzipB64: encodeTrace(TraceUploadSchema.parse(traceFixture)),
    });
    const first = await api.createTrip(req(false));
    const second = await api.createTrip(req(false));
    const updates = [first.progressUpdate, second.progressUpdate];
    expect(updates.map((u) => u?.tier.change).sort()).toEqual(['same', 'up']);
    expect(updates.some((u) => u?.streaks.phoneFree.change === 'broken')).toBe(true);

    const passenger = await api.createTrip(req(true));
    expect(passenger.progressUpdate?.qualifying).toBe(false);
    expect(passenger.progressUpdate?.readiness.delta).toBe(0);
  });
});
