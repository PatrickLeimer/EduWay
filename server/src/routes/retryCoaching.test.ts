// POST /trips/:id/coach: "Try again" for a trip saved without coaching (Gemini
// busy or out of quota). Real handlers, in-memory repo, a coach that fails the
// first time, and a fake Street View service.
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { gzipSync } from 'node:zlib';

import { coachOutputFixture, eventsFixture, traceFixture, tripFixture } from '@edudriver/fixtures';
import {
  CreateTripResponseSchema,
  DEMO_USER_ID,
  GetTripResponseSchema,
  type CreateTripRequest,
} from '@edudriver/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app';
import type { CoachService } from '../coach';
import { createInMemoryTripsRepo } from '../db';
import { mockScoreTrip } from '../scoring';
import type { StreetViewService } from '../streetview';

const servers: Server[] = [];
afterAll(() => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))));

/** Fails (coach: null) until `busy` is set to false, like Gemini on a bad minute. */
function flakyCoach() {
  const state = { busy: true };
  const coach: CoachService = {
    coachTrip: vi.fn(async (summary, tripId) =>
      state.busy
        ? { coach: null, audioUrl: null }
        : {
            coach: summary.street_view_event
              ? coachOutputFixture
              : { ...coachOutputFixture, street_view_caption: null },
            audioUrl: `/audio/${tripId}.mp3`,
          },
    ),
    ask: async () => '',
  };
  return { coach, state };
}

const google: StreetViewService = {
  hasCoverage: async () => true,
  fetchThumbnail: async () => null,
  panoramaHtml: () => null,
};

async function start(coach: CoachService) {
  const app = createApp({
    repo: createInMemoryTripsRepo(),
    scoreTrip: mockScoreTrip,
    coach,
    streetView: google,
  });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const { tripId: _t, userId: _u, ...traceUpload } = traceFixture;
const upload = (passenger = false): CreateTripRequest => ({
  userId: DEMO_USER_ID,
  trip: {
    startedAt: tripFixture.startedAt,
    endedAt: tripFixture.endedAt,
    distanceMi: tripFixture.distanceMi,
    passenger,
    lockEnabled: true,
  },
  events: eventsFixture,
  traceGzipB64: gzipSync(JSON.stringify(traceUpload)).toString('base64'),
});
const post = (url: string, body: unknown) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /trips/:id/coach', () => {
  it('coaches a trip that was saved without coaching, and fills the Street View caption', async () => {
    const { coach, state } = flakyCoach();
    const base = await start(coach);
    const first = CreateTripResponseSchema.parse(
      await (await post(`${base}/trips`, upload())).json(),
    );
    expect(first.coach).toBeNull();
    expect(first.streetView?.caption).toBeNull();

    state.busy = false;
    const res = await post(`${base}/trips/${first.trip._id}/coach`, {});
    expect(res.status).toBe(200);
    const retried = GetTripResponseSchema.parse(await res.json());
    expect(retried.trip.coach?.chat).toEqual(coachOutputFixture.chat);
    expect(retried.trip.coachAudioUrl).toBe(`/audio/${first.trip._id}.mp3`);
    // Same Street View spot as the upload picked, now with Gemini's caption.
    expect(retried.streetView?.eventId).toBe(first.streetView?.eventId);
    expect(retried.streetView?.caption).toBe(coachOutputFixture.street_view_caption);

    // Saved: the debrief shows it from now on.
    const saved = GetTripResponseSchema.parse(
      await (await fetch(`${base}/trips/${first.trip._id}`)).json(),
    );
    expect(saved.trip.coach).not.toBeNull();
    expect(saved.streetView?.caption).toBe(coachOutputFixture.street_view_caption);
  });

  it('still answers 200 with no coaching when it fails again', async () => {
    const { coach } = flakyCoach();
    const base = await start(coach);
    const first = CreateTripResponseSchema.parse(
      await (await post(`${base}/trips`, upload())).json(),
    );
    const retried = GetTripResponseSchema.parse(
      await (await post(`${base}/trips/${first.trip._id}/coach`, {})).json(),
    );
    expect(retried.trip.coach).toBeNull();
  });

  it('leaves coached and passenger trips alone', async () => {
    const { coach, state } = flakyCoach();
    state.busy = false;
    const base = await start(coach);
    const coached = CreateTripResponseSchema.parse(
      await (await post(`${base}/trips`, upload())).json(),
    );
    const passenger = CreateTripResponseSchema.parse(
      await (await post(`${base}/trips`, upload(true))).json(),
    );
    const calls = vi.mocked(coach.coachTrip).mock.calls.length;
    await post(`${base}/trips/${coached.trip._id}/coach`, {});
    await post(`${base}/trips/${passenger.trip._id}/coach`, {});
    expect(vi.mocked(coach.coachTrip).mock.calls.length).toBe(calls);
  });

  it('404s for an unknown trip', async () => {
    const base = await start(flakyCoach().coach);
    expect((await post(`${base}/trips/nope/coach`, {})).status).toBe(404);
  });
});
