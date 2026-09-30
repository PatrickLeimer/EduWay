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
  type DrivingEvent,
  type StreetViewCallout,
  type Trip,
  type TripSummary,
} from '@eduway/shared';
import { Router } from 'express';

import { buildTripSummary } from '../coach';
import { isRecurringSpot, pickStreetView, toCallout, type StreetViewChoice } from '../streetview';
import { computeProgressUpdate } from '../gamification';

import type { RouteDeps } from './deps';
import { HttpError, parseInput, sendValid } from './http';
import { buildRoutePreview, decodeTraceUpload } from './traceCodec';

export function tripsRouter({ repo, scoreTrip, coach, streetView: google }: RouteDeps): Router {
  const r = Router();

  /**
   * Coach a saved trip and store the result (§10, §11), plus the Street View
   * caption (§12). `choice` is the Street View pick: null when the picker ran
   * and nothing qualified, undefined when it didn't run (no key). Coaching
   * failures degrade to nulls (see coach/service.ts).
   */
  async function coachAndSave(
    trip: Trip,
    events: DrivingEvent[],
    history: TripSummary['history'],
    choice: StreetViewChoice | null | undefined,
  ) {
    const coachResult = await coach.coachTrip(
      buildTripSummary(trip, events, history, choice),
      trip._id,
    );
    await repo.setCoaching(trip._id, coachResult.coach, coachResult.audioUrl);
    let streetView: StreetViewCallout | null = null;
    if (choice) {
      const stored = {
        eventId: choice.event._id,
        heading: choice.heading,
        caption: coachResult.coach?.street_view_caption ?? null,
      };
      await repo.setStreetView(trip._id, stored);
      streetView = toCallout(trip._id, stored, events);
    }
    return { coachResult, streetView };
  }

  /** The debrief as GET /trips/:id returns it: the trip, its events and the saved callout. */
  async function debrief(trip: Trip, events: DrivingEvent[]) {
    const stored = google ? await repo.getStreetView(trip._id) : null;
    return { trip, events, streetView: stored ? toCallout(trip._id, stored, events) : null };
  }

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

    // Passenger trips are not coached (§4).
    let coachResult = { coach: null as typeof trip.coach, audioUrl: null as string | null };
    let streetView: StreetViewCallout | null = null;
    if (!trip.passenger) {
      const history = await repo.getHistory(body.userId, trip._id);
      // Street View (§12): pick → coverage check → heading, then the coach captions it.
      // Without a Street View key the picker doesn't run and the feature is absent.
      const choice = google
        ? await pickStreetView(events, trace, history.recurring_spots, google.hasCoverage)
        : undefined;
      ({ coachResult, streetView } = await coachAndSave(trip, events, history, choice));
    }

    // What this trip changed in streaks, tier and readiness, for the debrief to celebrate.
    const gamificationTrips = await repo.listGamificationTrips(body.userId);
    const latest = gamificationTrips.find((t) => t.id === trip._id);
    const progressUpdate = latest
      ? computeProgressUpdate(
          gamificationTrips.filter((t) => t.id !== trip._id),
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
        streetView,
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
    sendValid(res, GetTripResponseSchema, await debrief(found.trip, found.events));
  });

  /**
   * Re-run coaching for a trip saved without it (Gemini busy or out of quota);
   * the coaching screen's "Try again". Reuses the saved Street View pick. A trip
   * that already has coaching, or a passenger trip, is returned unchanged.
   */
  r.post('/:id/coach', async (req, res) => {
    const found = await repo.getTrip(req.params.id);
    if (!found) throw new HttpError(404, 'Trip not found');
    const { trip, events } = found;
    if (trip.passenger || trip.coach) {
      sendValid(res, GetTripResponseSchema, await debrief(trip, events));
      return;
    }
    const history = await repo.getHistory(trip.userId, trip._id);
    const stored = google ? await repo.getStreetView(trip._id) : null;
    const event = stored ? events.find((e) => e._id === stored.eventId) : undefined;
    const choice = !google
      ? undefined
      : stored && event
        ? {
            event,
            heading: stored.heading,
            recurringSpot: isRecurringSpot(event, history.recurring_spots),
          }
        : null;
    const { coachResult } = await coachAndSave(trip, events, history, choice);
    const coached = { ...trip, coach: coachResult.coach, coachAudioUrl: coachResult.audioUrl };
    sendValid(res, GetTripResponseSchema, await debrief(coached, events));
  });

  r.get('/:id/trace', async (req, res) => {
    const trace = await repo.getTrace(req.params.id);
    if (!trace) throw new HttpError(404, 'Trace not found');
    sendValid(res, GetTraceResponseSchema, trace);
  });

  return r;
}
