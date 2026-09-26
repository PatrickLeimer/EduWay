/**
 * trip/ public API (WS2). Other modules and ui/ import from here only.
 * Contract: ../contracts/trip.ts
 */
export { createTripSession, type TripSessionDeps } from './TripSession';
export { createExpoLocationSource, type LocationSource } from './locationSource';
export { createInMemoryUploadQueue } from './uploadQueue';
export { createTraceBuffer, type TraceBuffer } from './traceBuffer';
export { useTripState } from './useTripState';
export {
  createFixtureLocationSource,
  createMockTripSession,
  type MockTripSessionDeps,
} from './mocks';
