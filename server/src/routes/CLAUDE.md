# routes/ — WS3 HTTP API

**Owner:** WS3. Also owns `server/src/{app,index,config,wiring}.ts`.

## What it does
Express handlers for every endpoint in master doc §13. Each handler parses input with the shared zod schema, calls db/, scoring/ and coach/ through their interfaces, validates its output with the shared schema, and sends it. Errors always use the shared `ErrorResponse` shape.

## Must not
- Contain scoring, coaching or database query logic. Those live in scoring/, coach/, db/.
- Call Gemini or ElevenLabs directly. Use `CoachService`.
- Send a JSON response that has not passed its shared schema (`sendValid`). The Street View thumbnail (an image) and panorama (an HTML page) are the only non-JSON responses (§12).
- Add authentication beyond the simple `userId` (ask first).

## Contracts
- Implements: the HTTP API in `packages/shared/src/api.ts`.
- Consumes: `TripsRepo` (db/), `ScoreTrip` (scoring/), `CoachService` + `buildTripSummary` (coach/), and the optional `StreetViewService` (streetview/, §12), via `RouteDeps`.

## Mocks
Routes have no mock of their own: they are thin, so `routes.test.ts` runs the real handlers against the mock repo, scoring and coach. `src/wiring.ts` picks real or mock per module with `USE_REAL_DB`, `USE_REAL_SCORING`, `USE_REAL_COACH`.

## Done means (master doc §14)
- [ ] Saturday afternoon: backend deployed (host TBD); events saved in MongoDB through `POST /trips`.
- [ ] `/ask` pulls only relevant trips/events (stretch).
- [ ] Delete-trip endpoint if the team adopts §16 [Proposed].
- [ ] `routes.test.ts` still green with real scoring switched on.
