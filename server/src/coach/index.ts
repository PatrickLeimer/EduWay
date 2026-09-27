/** coach/ public API (WS4). Routes use CoachService and buildTripSummary only. */
export type { CoachResult, CoachService } from './types';
export { buildTripSummary, type StreetViewPick } from './summary';
export { createCoachService, type CoachServiceOptions } from './service';
export { createMockCoachService } from './mocks';
export { DEBRIEF_AUDIO_DIR, DEBRIEF_AUDIO_ROUTE } from './elevenlabs';
