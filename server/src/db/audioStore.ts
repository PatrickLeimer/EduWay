/**
 * Debrief mp3 storage (WS3). ElevenLabs audio lives in MongoDB GridFS so it
 * survives restarts and redeploys on hosts with an ephemeral disk (Render).
 * Keyed by file name ("<tripId>.mp3"), the same name as in coachAudioUrl.
 */
import { GridFSBucket, type Db } from 'mongodb';

export interface AudioStore {
  get(file: string): Promise<Buffer | null>;
  /** Replaces any earlier copy of the same file. */
  put(file: string, mp3: Buffer): Promise<void>;
}

export const DEBRIEF_AUDIO_BUCKET = 'debriefAudio';

export function createGridFsAudioStore(db: Db): AudioStore {
  const bucket = new GridFSBucket(db, { bucketName: DEBRIEF_AUDIO_BUCKET });
  return {
    async get(file) {
      const [found] = await bucket
        .find({ filename: file })
        .sort({ uploadDate: -1 })
        .limit(1)
        .toArray();
      if (!found) return null;
      const chunks: Buffer[] = [];
      for await (const chunk of bucket.openDownloadStream(found._id)) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks);
    },
    async put(file, mp3) {
      const old = await bucket.find({ filename: file }).toArray();
      await new Promise<void>((resolve, reject) => {
        bucket
          .openUploadStream(file, { metadata: { contentType: 'audio/mpeg' } })
          .once('finish', () => resolve())
          .once('error', reject)
          .end(mp3);
      });
      for (const f of old) await bucket.delete(f._id);
    },
  };
}

export function createInMemoryAudioStore(): AudioStore {
  const files = new Map<string, Buffer>();
  return {
    get: async (file) => files.get(file) ?? null,
    put: async (file, mp3) => {
      files.set(file, mp3);
    },
  };
}
