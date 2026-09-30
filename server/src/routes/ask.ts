/** POST /ask: "Ask the coach" (stretch, §10). WS3 route, WS4 answer. */
import { AskRequestSchema, AskResponseSchema, type DrivingEvent, type Trip } from '@eduway/shared';
import { Router } from 'express';

import type { RouteDeps } from './deps';
import { parseInput, sendValid } from './http';

export function askRouter({ repo, coach }: RouteDeps): Router {
  const r = Router();
  r.post('/', async (req, res) => {
    const { userId, question } = parseInput(AskRequestSchema, req.body);
    // TODO(WS3, §10): pull only the trips/events relevant to the question (e.g. last N trips,
    //   events of the asked-about type) instead of the whole history.
    const recent = (await repo.listTrips(userId)).slice(0, 5);
    const loaded = await Promise.all(recent.map((t) => repo.getTrip(t._id)));
    const trips: Trip[] = loaded.flatMap((l) => (l ? [l.trip] : []));
    const events: DrivingEvent[] = loaded.flatMap((l) => l?.events ?? []);
    sendValid(res, AskResponseSchema, { answer: await coach.ask(question, { trips, events }) });
  });
  return r;
}
