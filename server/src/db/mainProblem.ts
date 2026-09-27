/**
 * Picks history.main_problem from a user's events. Pure: MongoTripsRepo loads
 * the rows and this decides. Counts distinct trips, not individual events.
 */
import { COACH, type EventType, type MainProblem } from '@edudriver/shared';

/** Stored when a fix has no street name. Not a place the coach should name. */
const UNNAMED_STREET = 'an unnamed road';

export interface PatternEvent {
  type: EventType;
  street?: string | null;
  tripId: string;
}

export function pickMainProblem(events: readonly PatternEvent[]): MainProblem | null {
  const tripsByType = new Map<EventType, Set<string>>();
  for (const event of events) {
    const trips = tripsByType.get(event.type) ?? new Set<string>();
    trips.add(event.tripId);
    tripsByType.set(event.type, trips);
  }

  let best: { type: EventType; tripCount: number } | null = null;
  for (const [type, trips] of tripsByType) {
    const tripCount = trips.size;
    if (tripCount < COACH.mainProblemMinTrips) continue;
    if (
      !best ||
      tripCount > best.tripCount ||
      (tripCount === best.tripCount && tieRank(type) < tieRank(best.type))
    ) {
      best = { type, tripCount };
    }
  }
  if (!best) return null;

  const tripsByStreet = new Map<string, Set<string>>();
  for (const event of events) {
    if (event.type !== best.type) continue;
    const street = namedStreet(event.street);
    if (!street) continue;
    const trips = tripsByStreet.get(street) ?? new Set<string>();
    trips.add(event.tripId);
    tripsByStreet.set(street, trips);
  }

  let street: string | null = null;
  let streetTrips = 0;
  for (const [name, trips] of tripsByStreet) {
    if (trips.size < COACH.mainProblemStreetMinTrips) continue;
    if (
      trips.size > streetTrips ||
      (trips.size === streetTrips && street !== null && name < street)
    ) {
      street = name;
      streetTrips = trips.size;
    }
  }

  return { type: best.type, trip_count: best.tripCount, street };
}

function namedStreet(street: string | null | undefined): string | null {
  const trimmed = street?.trim();
  if (!trimmed || trimmed === UNNAMED_STREET) return null;
  return trimmed;
}

function tieRank(type: EventType): number {
  const index = COACH.mainProblemTieBreak.indexOf(type);
  return index === -1 ? COACH.mainProblemTieBreak.length : index;
}
