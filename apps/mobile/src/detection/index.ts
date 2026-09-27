/**
 * detection/ public API (WS1). Other modules import from here only.
 * Contracts: ../contracts/detection.ts
 */
export { createMotionDetector } from './MotionDetector';
export { createPhoneUseMonitor } from './PhoneUseMonitor';
export { createExpoMotionSource } from './expoMotionSource';
export {
  createMockMotionDetector,
  createMockMotionSource,
  createMockPhoneUseMonitor,
} from './mocks';
