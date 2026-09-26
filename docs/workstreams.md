# Workstreams

How the four developers (and the later UI phase) split the work. Rules: root `CLAUDE.md`. Product and technical decisions: `docs/driving-coach-master.md` (§ numbers below refer to it).

Everything defaults to **mocks**, so every workstream can run the whole app today and swap in its real module when it is ready:
- Mobile: flags in `apps/mobile/src/wiring.ts` (`USE_REAL.detection`, `.road`, `.trip`, `.api`, `.voice`, `.gps`).
- Server: env flags in `server/.env` (`USE_REAL_DB`, `USE_REAL_SCORING`, `USE_REAL_COACH`).

Shared contracts (need team agreement to change, own commit): `packages/shared/src/**`, `apps/mobile/src/contracts/**`, plus `server/src/coach/types.ts` (the WS3 ↔ WS4 boundary).

---

## WS1 Motion detection

**Owns:** `apps/mobile/src/detection/**`, `apps/mobile/src/ui/dev/Ws1Debug.tsx`
**Implements:** `MotionSource`, `MotionDetector`, `PhoneUseMonitor` (`contracts/detection.ts`)
**Consumes:** `MotionSample`, `GpsFix`, `DraftEvent`, thresholds (`@edudriver/shared`)
**Mocks you can rely on:** none needed. Detection only takes inputs; `createFixtureLocationSource` (trip/) gives you a GPS stream if you want one.

Tasks, in order:
1. `expoMotionSource.ts`: DeviceMotion at 20 ms, deg/s → rad/s. Show it in `Ws1Debug`, verify units on a still phone (§5). Flip `USE_REAL.detection` locally.
2. Level 1 math in pure code (§6): gravity axis, yaw rate, lateral = speed × yaw, horizontal magnitude with GPS dv/dt sign.
3. EMA filter and junk rejection (§7 steps 2–3).
4. Hysteresis state machines: brake, accel, turn, swerve (§7 table), merge within 3 s. Vitest with synthetic samples.
5. Phone use: AppState + `reportTouch` rules for lock on/off (§7, §18 flag 2).
6. Test drives (one drives, one watches, §15); tune thresholds in `thresholds.ts` (contract commit).
7. Stretch: Level 2 forward axis (§6).

Depends on: WS2 feeding GPS fixes to `onGps` (real TripSession). Until then, test with fixture GPS in Vitest.

## WS2 Road data + trip session

**Owns:** `apps/mobile/src/road/**`, `apps/mobile/src/trip/**`, `apps/mobile/src/wiring.ts`, `apps/mobile/src/ui/dev/Ws2Debug.tsx`
**Implements:** `RoadCache`, `RoadEventDetector`, `TripSession`, `UploadQueueStore`
**Consumes:** every other mobile contract (detection, voice, api)
**Mocks you can rely on:** `createMockMotionDetector` / `createMockPhoneUseMonitor` (fixture events), `createMockAlertPlayer` (logs, real cooldown), `createMockApiClient` (fixture responses).

Tasks, in order:
1. `locationSource.ts` with expo-location; trace recording already works (`traceBuffer.ts`).
2. Real `TripSession`: follow the TODOs in `TripSession.ts` using the mocks for detection/voice/api. Keep-awake on (§4). End Trip rule (30 s stopped).
3. Overpass query + parser + cache refresh near the edge (§8). Tests against `fixtures/overpass.response.json`.
4. Way matching with heading tie-break; `maxspeed` parsing; posted vs inferred limits.
5. Speeding and rolling stop detectors (§7, §8).
6. Offline queue retry; open decision on persistent storage (below).
7. Flip `wiring.ts` flags as each workstream lands; check the demo route's OSM tags (§8).

Depends on: WS1 (real detection), WS4 (real alerts), WS3 (real API). All mocked meanwhile.

## WS3 Backend + data

**Owns:** `server/src/**` except `coach/`, `apps/mobile/src/api/**`, `apps/mobile/src/ui/dev/Ws3Debug.tsx`
**Implements:** HTTP API (`shared/api.ts`), `TripsRepo`, `ScoreTrip`, mobile `ApiClient`
**Consumes:** `CoachService` (coach/)
**Mocks you can rely on:** `createMockCoachService` (fixture coaching). The in-memory repo and mock scoring are yours to replace.

Tasks, in order:
1. Create the Atlas cluster, fill `server/.env`, run `npm run db:setup`.
2. `MongoTripsRepo`: insert/list/get/trace (§9). Flip `USE_REAL_DB=true`.
3. Deploy the server (host TBD) so phones can reach it; set `EXPO_PUBLIC_API_URL` and `USE_REAL.api`.
4. `scoreTrip` (§7 "Scoring") with Vitest cases; flip `USE_REAL_SCORING=true`.
5. `getHistory` + recurring spots via 2dsphere (§1, §10); `getProgress` (§12 screen 5).
6. API client hardening: timeouts, retry for `createTrip`.
7. Stretch: `/ask` context selection; delete-trip (§16 [Proposed]).

Depends on: WS4 for real coaching (mocked). WS2 for real uploads (the mock trip already uploads through the API client).

## WS4 Coaching + voice

**Owns:** `server/src/coach/**`, `apps/mobile/src/voice/**`, `scripts/alert-clips/**`, `apps/mobile/assets/alerts/**`, `apps/mobile/src/ui/dev/Ws4Debug.tsx`
**Implements:** `CoachService`, `buildTripSummary`, `AlertPlayer`, `DebriefPlayer`
**Consumes:** `TripSummary`, `CoachOutput`, `LiveAlertType`, `ALERTS`, `COACH`
**Mocks you can rely on:** `fixtures/trip-summary.json` (Gemini input), `fixtures/coach-output.json` (expected shape), the in-memory repo (history).

Tasks, in order:
1. `npm run alert-clips`: generate and commit the clips; wire `AlertPlayer.ts` with expo-audio and cooldown (pure + tested). Flip `USE_REAL.voice`.
2. `buildTripSummary`: reproduce `fixtures/trip-summary.json` from the fixture trip (test).
3. Prompt (§10 guidelines) + Gemini JSON mode (`gemini.ts`). Iterate on the fixture summary.
4. ElevenLabs debrief (`elevenlabs.ts`) + audio hosting decision with WS3. Flip `USE_REAL_COACH=true`.
5. `DebriefPlayer` on the phone; WS2 plays it at trip end.
6. Stretch: `/ask`.

Depends on: WS3 for history and deployment (mocked by the in-memory repo). Nothing blocks steps 1–3.

## UI (later phase)

**Owns:** `apps/mobile/src/ui/**` (except the debug screens, owned by each workstream)
Screens today are placeholders (`ui/README.md`). The UI phase builds master doc §12 with Expo Router and `react-native-maps`, consuming only `trip/` and `api/`.

---

## Open decisions

| # | Decision | Who | Notes |
|---|---|---|---|
| 1 | Persistent offline upload queue storage | WS2 + team | Needs a dependency (e.g. expo-file-system or AsyncStorage). In-memory until then. |
| 2 | Where debrief mp3s are hosted | WS3 + WS4 | Server static files vs GridFS. `PUBLIC_BASE_URL` is in config for the static option. |
| 3 | Scoring weights | WS3 + team | `SCORING` in `thresholds.ts` are placeholders. |
| 4 | Test readiness rule (progress screen) | Team | `Progress.testReadiness` shape exists; rule TBD. |
| 5 | Backend host | WS3 | Kickoff says TBD. |
| 6 | Gemini model id | WS4 | `GEMINI_MODEL` env var; pick at the event. |
| 7 | Root CLAUDE.md: add `apps/mobile/assets/alerts/**` to WS4's owned paths | Team | Currently only listed here. |
