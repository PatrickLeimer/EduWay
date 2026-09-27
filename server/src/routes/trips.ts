/**
 * /trips endpoints (WS3). Master doc §13.
 * Thin: validate → call db / scoring / coach through their interfaces → validate → send.
 */
import {
  CreateTripRequestSchema,
  CreateTripResponseSchema,
  GetTraceResponseSchema,
  GetTripResponseSchema,
  ListTripsQuerySchema,
  ListTripsResponseSchema,
} from '@edudriver/shared';
import { Router } from 'express';

import { buildTripSummary } from '../coach';
import { computeProgressUpdate } from '../gamification';

import type { RouteDeps } from './deps';
import { HttpError, parseInput, sendValid } from './http';
import { buildRoutePreview, decodeTraceUpload } from './traceCodec';

export function tripsRouter({ repo, scoreTrip, coach }: RouteDeps): Router {
  const r = Router();

  /** Upload a finished trip; returns coaching + debrief audio URL (§3 "After the drive"). */
  r.post('/', async (req, res) => {
    const body = parseInput(CreateTripRequestSchema, req.body);
    const trace = decodeTraceUpload(body.traceGzipB64);

    const { score, counts, stats } = scoreTrip({
      events: body.events,
      distanceMi: body.trip.distanceMi,
      passenger: body.trip.passenger,
      trace,
    });

    const { trip, events } = await repo.insertTrip({
      trip: {
        ...body.trip,
        userId: body.userId,
        routePreview: buildRoutePreview(trace),
        counts,
        stats,
        score,
      },
      events: body.events,
      trace,
    });

    // Passenger trips are not coached (§4). Coaching failures degrade to nulls (see coach/service.ts).
    let coachResult = { coach: null as typeof trip.coach, audioUrl: null as string | null };
    if (!trip.passenger) {
      const history = await repo.getHistory(body.userId, trip._id);
      coachResult = await coach.coachTrip(buildTripSummary(trip, events, history), trip._id);
      await repo.setCoaching(trip._id, coachResult.coach, coachResult.audioUrl);
    }

    // What this trip changed in streaks, tier and readiness, for the debrief to celebrate.
    const history = await repo.listGamificationTrips(body.userId);
    const latest = history.find((t) => t.id === trip._id);
    const progressUpdate = latest
      ? computeProgressUpdate(
          history.filter((t) => t.id !== trip._id),
          latest,
        )
      : undefined;

    sendValid(
      res,
      CreateTripResponseSchema,
      {
        trip: { ...trip, coach: coachResult.coach, coachAudioUrl: coachResult.audioUrl },
        coach: coachResult.coach,
        coachAudioUrl: coachResult.audioUrl,
        progressUpdate,
      },
      201,
    );
  });

  r.get('/', async (req, res) => {
    const { userId } = parseInput(ListTripsQuerySchema, req.query);
    sendValid(res, ListTripsResponseSchema, { trips: await repo.listTrips(userId) });
  });

  r.get('/:id', async (req, res) => {
    const found = await repo.getTrip(req.params.id);
    if (!found) throw new HttpError(404, 'Trip not found');
    sendValid(res, GetTripResponseSchema, found);
  });

  r.get('/:id/trace', async (req, res) => {
    const trace = await repo.getTrace(req.params.id);
    if (!trace) throw new HttpError(404, 'Trace not found');
    sendValid(res, GetTraceResponseSchema, trace);
  });

  return r;
}
