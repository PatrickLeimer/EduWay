/** db/ public API (WS3). */
export type { NewTripInput, StoredStreetView, TripsRepo } from './repo';
export { connectDb, closeDb } from './client';
export { COLLECTIONS, INDEXES } from './collections';
export { ensureCollectionsAndIndexes } from './setup';
export { createMongoTripsRepo } from './MongoTripsRepo';
export { createInMemoryTripsRepo } from './mocks/InMemoryTripsRepo';
export {
  createGridFsAudioStore,
  createInMemoryAudioStore,
  DEBRIEF_AUDIO_BUCKET,
  type AudioStore,
} from './audioStore';
