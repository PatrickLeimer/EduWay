/**
 * MongoDB collection names and index definitions (master doc §9).
 * setup.ts applies these; MongoTripsRepo reads/writes the same collections.
 */
import type { IndexDescription } from 'mongodb';

export const COLLECTIONS = {
  users: 'users',
  trips: 'trips',
  events: 'events',
  traces: 'traces',
} as const;

export const INDEXES: Record<keyof typeof COLLECTIONS, IndexDescription[]> = {
  users: [],
  trips: [
    // Trip list and progress: newest trips for a user.
    { key: { userId: 1, startedAt: -1 }, name: 'userId_startedAt' },
  ],
  events: [
    // Recurring-spot detection across trips (§1 differentiator 3).
    { key: { location: '2dsphere' }, name: 'location_2dsphere' },
    { key: { tripId: 1, at: 1 }, name: 'tripId_at' },
    { key: { userId: 1, type: 1 }, name: 'userId_type' },
  ],
  traces: [
    // One trace per trip (§9).
    { key: { tripId: 1 }, name: 'tripId_unique', unique: true },
  ],
};
