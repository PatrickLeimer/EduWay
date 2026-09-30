/**
 * GET /audio/<tripId>.mp3: the ElevenLabs debrief (§11), served from the audio
 * store with Range support (iOS playback needs 206 responses). If the file is
 * missing but the trip was voiced before (the old disk copy was lost), the saved
 * chat is voiced once more, stored, and served. Otherwise 404; the app then
 * falls back to reading the chat.
 */
import type { CoachOutput } from '@eduway/shared';
import { Router, type Request, type Response } from 'express';

import type { AudioStore, TripsRepo } from '../db';
import { HttpError } from './http';

export interface DebriefAudioDeps {
  store: AudioStore;
  /** Voices a saved chat again into `store`; returns when each message starts. */
  revoice?: (coach: CoachOutput, tripId: string) => Promise<number[]>;
}

const FILE = /^([A-Za-z0-9_-]+)\.mp3$/;

export function audioRouter(repo: TripsRepo, audio: DebriefAudioDeps, route: string): Router {
  const r = Router();
  // One re-voice per file at a time, however many requests arrive together.
  const pending = new Map<string, Promise<Buffer | null>>();

  async function revoice(file: string, tripId: string): Promise<Buffer | null> {
    if (!audio.revoice) return null;
    const trip = (await repo.getTrip(tripId).catch(() => null))?.trip;
    // Only trips that had a voiced debrief; never spend credits on anything else.
    if (!trip?.coach || trip.passenger || trip.coachAudioUrl !== `${route}/${file}`) return null;
    try {
      const starts = await audio.revoice(trip.coach, tripId);
      if (trip.coach.chat?.length) {
        const coach = { ...trip.coach, chat_audio_starts_s: starts };
        await repo.setCoaching(tripId, coach, trip.coachAudioUrl);
      }
      return await audio.store.get(file);
    } catch (e) {
      console.error('[audio] re-voicing failed:', e);
      return null;
    }
  }

  r.get('/:file', async (req, res) => {
    const file = String(req.params.file);
    const match = FILE.exec(file);
    if (!match) throw new HttpError(404, 'Not found');
    let mp3 = await audio.store.get(file);
    if (!mp3) {
      let job = pending.get(file);
      if (!job) {
        job = revoice(file, match[1]!).finally(() => pending.delete(file));
        pending.set(file, job);
      }
      mp3 = await job;
    }
    if (!mp3) throw new HttpError(404, 'Not found');
    sendMp3(req, res, mp3);
  });
  return r;
}

function sendMp3(req: Request, res: Response, mp3: Buffer) {
  res.set({
    'Content-Type': 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
  });
  const ranges = req.range(mp3.length);
  if (ranges === -1) {
    res.status(416).set('Content-Range', `bytes */${mp3.length}`).end();
    return;
  }
  if (Array.isArray(ranges) && ranges.type === 'bytes' && ranges.length === 1) {
    const { start, end } = ranges[0]!;
    res.status(206).set({
      'Content-Range': `bytes ${start}-${end}/${mp3.length}`,
      'Content-Length': String(end - start + 1),
    });
    res.end(mp3.subarray(start, end + 1));
    return;
  }
  res.set('Content-Length', String(mp3.length)).end(mp3);
}
