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
| `summary.ts` | Done: reproduces `fixtures/trip-summary.json` from the fixture trip (tested) |
| `prompt.ts` | Done: §10 guidelines, voice rules kept separate for tuning (tested) |
| `gemini.ts` | STUB: `@google/genai` JSON mode |
| `elevenlabs.ts` | STUB: TTS + audio hosting (open decision) |
| `mocks/` | Fixture coaching + fake audio URL |

## Done means (master doc §14)
- [ ] Saturday night: Gemini returns schema-valid coaching for the fixture summary; ElevenLabs voices it; the app plays it.
- [ ] Inferred limits called "estimated"; phone use treated seriously without lecturing; ≤ 2 focus areas; debrief < 60 words.
- [ ] History comparison and recurring spots mentioned when present.
- [ ] Stretch: `/ask`.
