# coach/ — WS4 Gemini coaching + ElevenLabs debrief

**Owner:** WS4 (with `apps/mobile/src/voice/**` and `scripts/alert-clips/**`).

## What it does
Builds the compact trip summary (master doc §10 "Input"), asks Gemini for structured coaching JSON (§10 "Output", JSON mode), and voices `debrief_script` with ElevenLabs (§11). Also answers "Ask the coach" (stretch).

## Must not
- Send sensor data or the trace to Gemini. Only the summary.
- Let Gemini compute the score or invent events. The prompt must say so (§10 guidelines).
- Fail the trip upload when Gemini or ElevenLabs fails. Degrade to `coach: null` / `audioUrl: null`.
- Read `process.env` directly. Keys arrive via `CoachServiceOptions` from `src/wiring.ts`.

## Contracts
- Implements: `CoachService` (`types.ts`, shared with WS3's routes; agree changes first), `buildTripSummary`.
- Consumes: `TripSummary`, `CoachOutput` schemas, `COACH` and event thresholds from `@edudriver/shared`.

## Files
| File | Status |
|---|---|
| `service.ts` | Done: Gemini → ElevenLabs with graceful fallbacks |
| `promptContext.ts` | Done: thresholds rendered for the prompt |
| `summary.ts` | Done: reproduces `fixtures/trip-summary.json` from the fixture trip; adds `street_view_event` when the backend picked one (tested) |
| `prompt.ts` | Done: §10 guidelines + conversational chat rules and a style example; Street View caption rules (§12: event data only, never describe the picture) (tested) |
| `gemini.ts` | Done: JSON mode (chat required), reply validated; falls back through `GEMINI_FALLBACK_MODELS` one call each, then one more pass after 3 s skipping models out of quota (tested with a fake SDK) |
| `elevenlabs.ts` | Done: chat voiced as one track with character timings → `chat_audio_starts_s`; mp3 saved to `server/audio`, served at `/audio` (tested) |
| `mocks/` | Fixture coaching + fake audio URL |

## Done means (master doc §14)
- [ ] Saturday night: Gemini returns schema-valid coaching for the fixture summary; ElevenLabs voices it; the app plays it.
- [ ] Inferred limits called "estimated"; phone use treated seriously without lecturing; ≤ 2 focus areas; debrief < 60 words.
- [ ] History comparison and recurring spots mentioned when present.
- [ ] Stretch: `/ask`.
