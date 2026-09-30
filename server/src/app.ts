/**
 * Express app factory (WS3). Kept separate from index.ts so tests can mount
 * the app on an ephemeral port with mock dependencies.
 */
import { API_ROUTES } from '@edudriver/shared';
import express, { type Express } from 'express';

import { DEBRIEF_AUDIO_DIR, DEBRIEF_AUDIO_ROUTE } from './coach';
import {
  askRouter,
  audioRouter,
  errorHandler,
  progressRouter,
  streetViewRouter,
  tripsRouter,
  type RouteDeps,
} from './routes';

export function createApp(deps: RouteDeps): Express {
  const app = express();
  // Traces arrive gzipped+base64 inside JSON; a long trip is well under this (§9).
  app.use(express.json({ limit: '5mb' }));

  app.get(API_ROUTES.health, (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/trips', tripsRouter(deps));
  app.use(API_ROUTES.getProgress, progressRouter(deps));
  app.use(API_ROUTES.ask, askRouter(deps));
  // Street View callout images and panorama page (§12); off without GOOGLE_STREETVIEW_KEY.
  app.use('/streetview', streetViewRouter(deps));
  // ElevenLabs debrief mp3s (§11); coachAudioUrl points here. From MongoDB when
  // deps.audio is set, else the old disk folder (rollback: DEBRIEF_AUDIO_IN_DB=false).
  if (deps.audio) {
    app.use(DEBRIEF_AUDIO_ROUTE, audioRouter(deps.repo, deps.audio, DEBRIEF_AUDIO_ROUTE));
  } else {
    app.use(DEBRIEF_AUDIO_ROUTE, express.static(DEBRIEF_AUDIO_DIR));
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}
