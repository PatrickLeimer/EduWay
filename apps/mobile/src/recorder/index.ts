/**
 * recorder/ public API (dev-only drive recorder). ui/ imports from here only.
 * How to use it on a test drive: docs/drive-recording.md.
 */
export {
  createPhoneRecording,
  deleteRecording,
  listRecordings,
  shareRecording,
  type PhoneRecording,
  type SavedRecording,
} from './expo';
export type { RecordedEvent, RecorderStatus } from './DriveRecorder';
export {
  MARKERS,
  MARKER_TYPES,
  SEGMENTS,
  clock,
  type MarkerType,
  type Mount,
  type Segment,
} from './format';
