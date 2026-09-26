/**
 * voice/ public API (WS4). Other modules import from here only.
 * Contract: ../contracts/voice.ts
 */
export { createAlertPlayer, createDebriefPlayer } from './AlertPlayer';
export { clipIdFor, SPEED_LIMIT_CLIPS_MPH } from './clips';
export { createMockAlertPlayer, createMockDebriefPlayer, type MockAlertPlayer } from './mocks';
