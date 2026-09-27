/**
 * In-memory UploadQueueStore (§4 "Offline"). Loses queued trips if the app is
 * killed. TODO(WS2): swap for a persistent store once the team approves a
 * storage dependency (see docs/workstreams.md "Open decisions").
 */
import type { QueuedUpload, UploadQueueStore } from '../contracts';

export function createInMemoryUploadQueue(): UploadQueueStore {
  const items = new Map<string, QueuedUpload>();
  return {
    async enqueue(item) {
      items.set(item.id, item);
    },
    async peekAll() {
      return [...items.values()];
    },
    async remove(id) {
      items.delete(id);
    },
  };
}
