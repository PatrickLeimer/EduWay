// Every endpoint, mounted on an ephemeral port with mock deps, returns data that
// passes the shared response schemas. Doubles as the scaffold's endpoint smoke test.
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { gzipSync } from 'node:zlib';

import { eventsFixture, traceFixture, tripFixture } from '@edudriver/fixtures';
import {
  AskResponseSchema,
  CreateTripResponseSchema,
  DEMO_USER_ID,
  ErrorResponseSchema,
  GetProgressResponseSchema,
  GetTraceResponseSchema,
  GetTripResponseSchema,
  ListTripsResponseSchema,
  type CreateTripRequest,
} from '@edudriver/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { createMockCoachService } from '../coach';
import { createInMemoryTripsRepo } from '../db';
import { mockScoreTrip } from '../scoring';

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApp({
    repo: createInMemoryTripsRepo(),
    scoreTrip: mockScoreTrip,
    coach: createMockCoachService(),
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const get = (path: string) => fetch(base + path);
const post = (path: string, body: unknown) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('API routes (mock deps)', () => {
  const { tripId: _t, userId: _u, ...traceUpload } = traceFixture;
  const createReq: CreateTripRequest = {
    userId: DEMO_USER_ID,
    trip: {
      startedAt: tripFixture.startedAt,
      endedAt: tripFixture.endedAt,
      distanceMi: tripFixture.distanceMi,
      passenger: false,
      lockEnabled: true,
    },
    events: eventsFixture,
    traceGzipB64: gzipSync(JSON.stringify(traceUpload)).toString('base64'),
  };

  it('POST /trips → coaching', async () => {
    const res = await post('/trips', createReq);
    expect(res.status).toBe(201);
    const body = CreateTripResponseSchema.parse(await res.json());
    expect(body.coach).not.toBeNull();
  });

  it('POST /trips rejects a bad body with ErrorResponse', async () => {
    const res = await post('/trips', { ...createReq, traceGzipB64: 'not-gzip' });
    expect(res.status).toBe(400);
    ErrorResponseSchema.parse(await res.json());
  });

  it('GET /trips, /trips/:id, /trips/:id/trace', async () => {
    const list = ListTripsResponseSchema.parse(
      await (await get(`/trips?userId=${DEMO_USER_ID}`)).json(),
    );
    expect(list.trips.length).toBeGreaterThan(0);
    const id = list.trips[0]!._id;
    GetTripResponseSchema.parse(await (await get(`/trips/${id}`)).json());
    GetTraceResponseSchema.parse(await (await get(`/trips/${id}/trace`)).json());
    expect((await get('/trips/nope')).status).toBe(404);
  });

  it('GET /progress and POST /ask', async () => {
    GetProgressResponseSchema.parse(await (await get(`/progress?userId=${DEMO_USER_ID}`)).json());
    AskResponseSchema.parse(
      await (
        await post('/ask', { userId: DEMO_USER_ID, question: 'Am I better at stops?' })
      ).json(),
    );
  });
});
