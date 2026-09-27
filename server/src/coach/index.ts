/** coach/ public API (WS4). Routes use CoachService and buildTripSummary only. */
export type { CoachResult, CoachService } from './types';
export { buildTripSummary } from './summary';
export { createCoachService, type CoachServiceOptions } from './service';
export { createMockCoachService } from './mocks';
