# Render or Railway Deployment

Last updated 2026-09-26.

## Context

WS3: deploy the Express API in `server/` to Render (recommended) or Railway, then send back its public HTTPS URL. MongoDB Atlas is already hosted; it only stores data, so the phone still needs this API to reach.

The mobile side is done (merged in PR #15): `expo-updates` is installed, `runtimeVersion` uses the `sdkVersion` policy so Expo Go can open updates, and `npm run publish:demo --workspace @edudriver/mobile` publishes a QR code on expo.dev.

Handoff:

1. WS3 deploys the server and confirms `/health` returns `{"ok":true}`.
2. WS3 sends the URL (for example `https://edudriver.onrender.com`, no trailing slash).
3. The EAS owner runs `eas env:set` with that URL and publishes the demo build.

## Option A: Render (recommended)

No code changes: Render runs the server as a normal Node process, exactly like `npm run start` locally.

1. In the Render dashboard: New → Web Service → connect the GitHub repo.
2. Branch: `main`.
3. Root Directory: leave blank. This is an npm workspace; the install must run from the repo root so `@edudriver/shared` resolves.
4. Runtime: Node. Build command: `npm ci --include=dev` (the server runs through `tsx`, which is a root devDependency).
5. Start command: `npm run start --workspace @edudriver/server`
6. Instance type: Free is fine for the demo.
7. Environment: add every variable in the table below, plus `NODE_VERSION=22`. Do not set `PORT`; Render injects it and the server reads it.
8. In MongoDB Atlas → Network Access, allow `0.0.0.0/0`, or Atlas will reject Render.
9. Deploy, then open `https://<service>.onrender.com/health`.

## Option B: Railway

Same idea as Render, and the service does not sleep; it runs on trial or paid credits.

1. New Project → Deploy from GitHub repo → pick the repo and branch.
2. Service → Settings: leave Root Directory blank (repo root).
3. Custom build command: `npm ci --include=dev`
4. Custom start command: `npm run start --workspace @edudriver/server`
5. Variables tab: use the Raw Editor to paste the contents of `server/.env`, then delete the `PORT` line (Railway injects it).
6. Settings → Networking → Generate Domain to get a public `*.up.railway.app` URL.
7. In MongoDB Atlas → Network Access, allow `0.0.0.0/0`.
8. Redeploy, then open `https://<domain>/health`.

## Environment variables

Set these on the host; values come from the team's `server/.env`. Names match `server/src/config.ts`. Unset `USE_REAL_*` flags default to mock.

| Variable | Value for the demo | Notes |
| --- | --- | --- |
| `MONGODB_URI` | Atlas connection string | Required when `USE_REAL_DB=true` |
| `MONGODB_DB` | `edudriver` (default) | Only if the team uses another name |
| `GEMINI_API_KEY` | from `server/.env` | Secret |
| `GEMINI_MODEL` | from `server/.env` | WS4's chosen model id |
| `ELEVENLABS_API_KEY` | from `server/.env` | Secret |
| `ELEVENLABS_VOICE_ID` | from `server/.env` |  |
| `PUBLIC_BASE_URL` | the deployed URL itself | Set after the first deploy gives you the URL, then redeploy |
| `USE_REAL_DB` | `true` |  |
| `USE_REAL_SCORING` | `true` |  |
| `USE_REAL_COACH` | `true` if the coach is ready | Otherwise the debrief is mocked |
| `NODE_VERSION` | `22` | Render only; matches `.nvmrc` |
| `PORT` | do not set | The host injects it |

Run `npm run db:setup` once against Atlas (locally, with the same `MONGODB_URI`) if the collections and indexes do not exist yet.

## Verify and hand back

- [ ] `https://<url>/health` returns `{"ok":true}` from a phone on cellular data (not campus wifi)
- [ ] Host logs show `db: real, scoring: real` (the startup line) and no Atlas connection errors
- [ ] `PUBLIC_BASE_URL` set to the URL and redeployed
- [ ] URL sent to the EAS owner: `https://...`, no trailing slash, no port

The EAS owner then runs, from `apps/mobile`:

```
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://<url> --environment preview --visibility plaintext
npm run publish:demo --workspace @edudriver/mobile
```

The publish prints an expo.dev link; its page shows the Expo Go QR code.

## Gotchas

- **Render free tier sleeps** after about 15 minutes idle; the first request then takes up to a minute. Hit `/health` a few minutes before demoing.
- **Debrief mp3 storage is still an open decision** (`server/src/coach/elevenlabs.ts`). The host disk is wiped on every redeploy, so prefer MongoDB GridFS over serving files from disk.
- **The app still uses the mock API.** `USE_REAL.api` is `false` in `apps/mobile/src/wiring.ts` (WS2 owns it). Flip it once the server is up, or the published build never calls this server.
- **Why not Vercel or Netlify:** Vercel turns the app into a serverless function with no bundling, and our server imports `@edudriver/shared` as raw TypeScript, so it may fail at runtime; `express.static` also does not work there. Netlify needs a wrapper dependency and has short function timeouts for the Gemini + ElevenLabs debrief.
- **Secrets stay on the host.** Never put Gemini, ElevenLabs or MongoDB values into `eas env:set`; only `EXPO_PUBLIC_API_URL` goes there, and it ends up readable in the app bundle.
