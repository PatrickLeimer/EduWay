// Street View end to end through the real handlers (§12): upload picks the event,
// the debrief carries the callout, and the thumbnail and panorama come from our
// backend. Google is faked; the coach is the mock.
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { gzipSync } from 'node:zlib';

import { eventsFixture, traceFixture, tripFixture } from '@edudriver/fixtures';
import {
  CreateTripResponseSchema,
  DEMO_USER_ID,
  GetTripResponseSchema,
  STREET_VIEW,
  type CreateTripRequest,
} from '@edudriver/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app';
import { createMockCoachService } from '../coach';
import { createInMemoryTripsRepo } from '../db';
import { mockScoreTrip } from '../scoring';
import type { StreetViewService } from '../streetview';

const servers: Server[] = [];
afterAll(() => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))));

async function start(streetView?: StreetViewService) {
  const app = createApp({
    repo: createInMemoryTripsRepo(),
    scoreTrip: mockScoreTrip,
    coach: createMockCoachService(),
    streetView,
  });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const { tripId: _t, userId: _u, ...traceUpload } = traceFixture;
const upload: CreateTripRequest = {
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
const post = (base: string, body: CreateTripRequest) =>
  fetch(`${base}/trips`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

function fakeGoogle(): StreetViewService & { thumbnails: number[][] } {
  const thumbnails: number[][] = [];
  return {
    thumbnails,
    hasCoverage: vi.fn(async () => true),
    fetchThumbnail: vi.fn(async (lat: number, lng: number, heading: number) => {
      thumbnails.push([lat, lng, heading]);
      return { bytes: Buffer.from([0xff, 0xd8, 0xff]), contentType: 'image/jpeg' };
    }),
    panoramaHtml: vi.fn((_lat: number, _lng: number, heading: number) => `<html>${heading}</html>`),
  };
}

describe('Street View routes (§12)', () => {
  it('picks the event on upload and returns the callout with our URLs and the caption', async () => {
    const base = await start(fakeGoogle());
    const res = await post(base, upload);
    const body = CreateTripResponseSchema.parse(await res.json());
    const id = body.trip._id;
    expect(body.streetView).toMatchObject({
      eventType: 'hard_brake',
      street: 'SW 8th St',
      lat: 25.7625,
      lng: -80.354487,
      heading: 90,
      caption: body.coach?.street_view_caption,
      thumbnailUrl: `/streetview/${id}/thumbnail`,
      panoramaUrl: `/streetview/${id}/panorama`,
    });
    expect(body.coach?.street_view_caption).toBeTruthy();

    const debrief = GetTripResponseSchema.parse(await (await fetch(`${base}/trips/${id}`)).json());
    expect(debrief.streetView).toEqual(body.streetView);
  });

  it('streams the thumbnail with a short cache header and serves the panorama page', async () => {
    const google = fakeGoogle();
    const base = await start(google);
    const { trip } = CreateTripResponseSchema.parse(await (await post(base, upload)).json());

    const thumb = await fetch(`${base}/streetview/${trip._id}/thumbnail`);
    expect(thumb.status).toBe(200);
    expect(thumb.headers.get('content-type')).toBe('image/jpeg');
    expect(thumb.headers.get('cache-control')).toBe(
      `private, max-age=${STREET_VIEW.thumbnailCacheS}`,
    );
    expect([...new Uint8Array(await thumb.arrayBuffer())]).toEqual([0xff, 0xd8, 0xff]);
    expect(google.thumbnails).toEqual([[25.7625, -80.354487, 90]]);

    const pano = await fetch(`${base}/streetview/${trip._id}/panorama`);
    expect(pano.headers.get('content-type')).toMatch(/text\/html/);
    expect(await pano.text()).toBe('<html>90</html>');
  });

  it('has no callout for passenger trips or when nothing has imagery', async () => {
    const google = fakeGoogle();
    const base = await start(google);
    const passenger = await post(base, { ...upload, trip: { ...upload.trip, passenger: true } });
    expect(CreateTripResponseSchema.parse(await passenger.json()).streetView).toBeNull();

    vi.mocked(google.hasCoverage).mockResolvedValue(false);
    const noImagery = CreateTripResponseSchema.parse(await (await post(base, upload)).json());
    expect(noImagery.streetView).toBeNull();
    expect(noImagery.coach?.street_view_caption).toBeNull();
    expect((await fetch(`${base}/streetview/${noImagery.trip._id}/thumbnail`)).status).toBe(404);
  });

  it('is off without a Street View key', async () => {
    const base = await start(undefined);
    const body = CreateTripResponseSchema.parse(await (await post(base, upload)).json());
    expect(body.streetView).toBeNull();
    expect((await fetch(`${base}/streetview/${body.trip._id}/panorama`)).status).toBe(404);
  });
});
