/**
 * Server entry: load config, build dependencies, listen.
 * `npm run dev:server` from the repo root.
 */
import { createApp } from './app';
import { loadConfig } from './config';
import { createDeps } from './wiring';

const config = loadConfig();
const deps = await createDeps(config);

createApp(deps).listen(config.PORT, () => {
  const mode = (on: boolean) => (on ? 'real' : 'mock');
  console.log(
    `EduDriver API on http://localhost:${config.PORT} ` +
      `(db: ${mode(config.USE_REAL_DB)}, scoring: ${mode(config.USE_REAL_SCORING)}, ` +
      `coach: ${mode(config.USE_REAL_COACH)})`,
  );
});
