# voice/ — WS4 Live alerts + debrief playback

**Owner:** WS4 (with `server/src/coach/**` and `scripts/alert-clips/**`). Debug screen: `src/ui/dev/Ws4Debug.tsx`.
Bundled clips live in `apps/mobile/assets/alerts/` (WS4).

## What it does
Plays pre-generated ElevenLabs clips for dangerous moments during the drive, with a per-type cooldown (master doc §7 "Live ElevenLabs alerts"). Plays the ElevenLabs debrief the server returns after the trip (§11).

## Must not
- Show anything visual for alerts. Voice only.
- Call ElevenLabs at runtime for live alerts. Clips are bundled for zero latency and offline use.
- Decide *whether* an event deserves an alert. trip/ decides; voice/ plays and applies cooldown.
- Hard-code the cooldown. Use `ALERTS` from `@eduway/shared` (phone use is exempt).

## Contracts
- Implements: `AlertPlayer`, `DebriefPlayer` (`src/contracts/voice.ts`).
- Consumes: `LiveAlertType`, `ALERTS` from `@eduway/shared`.
- Public API: `index.ts` only.

## Files
| File | Status |
|---|---|
| `clips.ts` | Done: alert → clip id (speeding picks the matching limit clip); tests check manifest, mp3s, and the require map agree |
| `cooldown.ts` | Done: per-type cooldown, phone use exempt (pure, tested) |
| `AlertPlayer.ts` | Done: expo-audio alerts over music with `cooldown.ts`; debrief streaming with pause/resume/position for the coach chat |
| `audioUrl.ts` | Done: resolves the server's relative `/audio/...` path against `API_BASE_URL` (tested) |
| `mocks/` | Logs instead of playing; uses `cooldown.ts`; mock debrief runs a 45 s clock |

## Done means (master doc §14)
- [x] Saturday night: clips generated (`npm run alert-clips`) and committed to `assets/alerts/`.
- [ ] Alerts play over music with the screen on; cooldown 60 s per type, phone use exempt.
- [x] Debrief plays from the server URL on the coach screen, in sync with the chat.
- [x] Cooldown logic in a pure file with Vitest tests.
