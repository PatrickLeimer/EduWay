/** GET /progress (WS3). Master doc §12 screen 5, §13. */
import { GetProgressQuerySchema, GetProgressResponseSchema } from '@edudriver/shared';
import { Router } from 'express';

import type { RouteDeps } from './deps';
import { parseInput, sendValid } from './http';

export function progressRouter({ repo }: RouteDeps): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    const { userId } = parseInput(GetProgressQuerySchema, req.query);
    sendValid(res, GetProgressResponseSchema, await repo.getProgress(userId));
  });
  return r;
}
