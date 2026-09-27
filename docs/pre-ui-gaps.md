# What's missing before the UI phase

Checked against `main` at `a023267` (after PR #8), 2026-09-26. Section numbers refer to `docs/driving-coach-master.md`; open decision numbers refer to `docs/workstreams.md`.

**Summary:** the logic layer is mostly built. `npm run typecheck` is clean and `npm test` passes (144 passed, 3 skipped). But the app has never run end to end on real modules, three server functions are still stubs, and **the test drive has not happened yet.** The UI only renders what `trip/` and `api/` return, so starting it now would mean building on mock data.

---

## 1. Blockers for the UI phase

| # | Missing | Owner | Where | Why it blocks the UI |
|---|---|---|---|---|
| 1 | **Trip scoring** is a stub. Every trip returns `score: null` and all counts at 0. | WS3 | `server/src/scoring/score.ts` (`scoreTrip`) | Screens 3 (debrief), 5 (progress) and the trip list all show the score and counts (§7 "Scoring", §12). |
| 2 | **Progress endpoint** throws. | WS3 | `server/src/db/MongoTripsRepo.ts` (`getProgress`) | Screen 5 has no data (§12). Also needs open decision 4 (test readiness rule). |
| 3 | **Voice debrief** throws. | WS4 (+ WS3) | `server/src/coach/elevenlabs.ts` (`synthesizeDebrief`) | No debrief audio, the strongest demo moment (§17 step 4). Needs open decision 2 first: static files vs GridFS. |
| 4 | **Backend not deployed.** Host still undecided. | WS3 | open decision 5 | Until phones can reach it, `USE_REAL.api` stays `false` and every screen reads mock fixtures. |
| 5 | **Speed vs limit timeline** has no data source. The trace stores speed but no limit per point (`TraceSchema` in `packages/shared/src/types.ts`). Events carry the limit only where they happened. | Team | contract change | Screen 4 replay (§9 "Replay"). Either add a limit column to the trace (contract change to `TraceUpload` and the `traces` schema) or pick another source. Decide before anyone builds screen 4. |

## 2. Test drive (not done yet)

This is the biggest unknown and should come **before** the UI. Everything the drive tests runs on the phone, so it doesn't need items 1–4 above.

**Setup:** in `apps/mobile/src/wiring.ts` set `detection`, `gps` and `voice` to real (`api` too if the server is up). Record with the Drive recorder (Dev menu) following `docs/drive-recording.md`. One person drives, one watches (§15).

**What it has to answer:**

- [ ] **Detection thresholds.** Brake, accel, turn and swerve have only been tested on synthetic samples. Tune `thresholds.ts` from the recordings (contract commit).
- [ ] **Overpass reachability on mobile data.** It returned HTTP 406 from a laptop on 2026-09-26 and the mirrors returned 504. If it fails, speeding, rolling stops and street names are silently off for the whole trip (only `lastError` on the WS2 debug screen shows it).
- [ ] **Demo route.** The recorder report shows % of fixes matched to a street and % with posted vs inferred limits. Pick a route with posted limits (§8, WS2 task 7).
- [ ] **Alerts.** Clips play on the right events, the cooldown feels right, and the voice doesn't distract the driver (§17 "Be ready for").
- [ ] **Rolling stop radius.** At 1 Hz and 30 mph the car moves about 13 m per fix, so it can pass a sign with no fix inside `ROLLING_STOP.signRadiusM` (15 m).
- [ ] **A real recorded trip for the demo replay** (§17 step 2).

## 3. Flags still on mock

`apps/mobile/src/wiring.ts`, `USE_REAL`:

| Flag | Now | Flip when |
|---|---|---|
| `road` | real | done |
| `trip` | real | done |
| `detection` | mock | after the test drive confirms it works |
| `gps` | fixture replay | on a phone (test drive) |
| `voice` | mock | after the test drive confirms alerts |
| `api` | mock | once the server is deployed |

`server/.env`: `USE_REAL_DB`, `USE_REAL_SCORING`, `USE_REAL_COACH` default to `false`. `USE_REAL_SCORING` waits on item 1; `USE_REAL_COACH` on item 3.

## 4. Known issues (not blocking the UI, fix before the demo)

**WS2 road and trip** (details in `docs/ws2-maps-osm-status.md`; that note's Google Maps section is out of date, since `react-native-maps` is now installed and the WS2 debug map exists):

- One hard-coded Overpass endpoint (`road/overpass.ts` `OVERPASS_URL`), no fallback list.
- No retry backoff after a failed fetch: it retries on every GPS fix. Needs a new threshold (suggested `ROAD.refetchBackoffS`), which is a contract change.
- Duplicate `rolling_stop` events at intersections with several stop nodes close together.
- Speeding episodes split at way boundaries; harsh speeding can come from a single fix.
- Upload queue is in memory only (`trip/uploadQueue.ts`); trips queued offline are lost if the app is killed (open decision 1). `expo-file-system` is already approved.

**WS3 backend:**

- API client has no request timeout or retry for `createTrip` (`api/HttpApiClient.ts`).
- Scoring weights in `SCORING` are placeholders (open decision 3).

**WS4 coach:**

- Gemini model id not picked yet (`GEMINI_MODEL`, open decision 6).

**Housekeeping:**

- The driving screen shows OSM street names without "© OpenStreetMap contributors" (§8 "Display"). Fix it in the UI phase.
- A root-level `tsconfig.json` and `.expo/` folder appeared locally, probably from running `expo start` at the repo root instead of `apps/mobile`. They are not committed; don't commit them.

## 5. Stretch (not needed for the UI phase)

- `/ask` endpoint: `CoachService.ask` throws (`server/src/coach/service.ts`) and context selection is a TODO (`server/src/routes/ask.ts`) (§10 "Ask the coach").
- Level 2 forward-axis learning (`detection/MotionDetector.ts`, §6).
- Douglas-Peucker for route thumbnails (`server/src/routes/traceCodec.ts`).

---

## Suggested order

1. **Test drive** with all phone-side flags real and the recorder running (section 2).
2. **At the same time:** WS3 does scoring and the deploy; WS3 + WS4 decide audio hosting and finish `synthesizeDebrief`; the team decides the readiness rule and the per-point speed limit question.
3. Tune thresholds from the recordings, flip every flag to real, and run one full trip: start, drive, end, voice debrief, trip shows in history.
4. **Start the UI.** Screens 1–3 can start once step 3 works. Screen 4 (map and replay) and screen 5 (progress) wait on items 5 and 2.
