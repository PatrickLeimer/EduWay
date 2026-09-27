# scripts/alert-clips/ — WS4 Live alert clip generator

**Owner:** WS4.

## What it does
Generates the pre-recorded ElevenLabs clips for live alerts (master doc §7) from `clips.manifest.json` into `apps/mobile/assets/alerts/<id>.mp3`. Run once (and when texts change): `npm run alert-clips`.

## Must not
- Run inside the app or the server. It is a developer script.
- Commit API keys. It reads `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` from `server/.env`.
- Drift from `apps/mobile/src/voice/clips.ts`. The test checks every speed-limit clip exists.

## Done means (master doc §14)
- [ ] Saturday night: all manifest clips generated, listened to, and committed.
- [x] Same voice as the debrief (`ELEVENLABS_VOICE_ID`); same model via `textToSpeechMp3` in `server/src/coach/elevenlabs.ts`.
