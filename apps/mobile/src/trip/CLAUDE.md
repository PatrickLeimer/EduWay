# trip/ — WS2 Trip session

**Owner:** WS2 (with `road/` and `src/wiring.ts`). Debug screen: `src/ui/dev/Ws2Debug.tsx`.

## What it does
Runs a drive from Start to End (master doc §4). Owns the single GPS subscription and records the 1 Hz route trace (§9) — that trace is the polyline Google Maps will draw. Fans fixes and samples out to detection/ and road/, adds OSM road context (street, class, limit, confidence) to every event so the map can label pins, decides live alerts and calls voice/, then uploads through api/ (or queues offline). It is the only thing the Driving screen talks to.

## Must not
- Store or upload motion samples. Only the GPS trace is kept (§3, §9).
- Allow End Trip unless the car has been stopped for `TRIP.minStoppedToEndS` (30 s) (§4).
- Alert on non-harsh events, on hard acceleration, on rolling stops, or on speeding against an inferred limit (§7).
- Score or coach (the server does that).
- Implement auto-start or background tracking (out of scope).

## Contracts
- Implements: `TripSession`, `UploadQueueStore` (`src/contracts/trip.ts`).
- Consumes: `MotionSource`, `MotionDetector`, `PhoneUseMonitor`, `RoadCache`, `RoadEventDetector`, `AlertPlayer`, `ApiClient` (all injected by `wiring.ts`).
- Internal: `LocationSource` (`locationSource.ts`).
- Public API: `index.ts` only.

## Files
| File | Status |
|---|---|
| `traceBuffer.ts` | Done: columnar trace recorder |
| `stateStore.ts` | Done: immutable TripState store |
| `uploadQueue.ts` | Done: in-memory queue (persistent store is an open decision) |
| `useTripState.ts` | Done: React binding for screens |
| `locationSource.ts` | Done: expo-location adapter (SDK 57 `watchPositionAsync`) |
| `keepAwake.ts` | Done: `expo-keep-awake` while a trip is running |
| `TripSession.ts` | Done: orchestration (GPS, detectors, alerts, 30 s end rule, upload or queue) |
| `mocks/` | Fixture GPS replay; full mock drive with alerts + upload |

## Done means (master doc §14)
- [x] Saturday afternoon: real TripSession runs with real GPS; trace recorded at 1 Hz; `expo-keep-awake` on while driving. `USE_REAL.gps` stays off so a desk run replays the fixture.
- [x] Events from all detectors get street, road class, limit and confidence; live alerts follow §7.
- [x] End Trip only after 30 s stopped; upload via `api.createTrip`; queue and retry when offline. The queue is still in-memory (open decision 1).
- [x] Passenger trips recorded but not scored (§4). Phone skips live alerts and the debrief; the server owns the score.
- [x] Debrief audio plays when the trip ends (via voice/ DebriefPlayer; add to deps).
- [x] `wiring.ts` flags flipped to real as modules land. `road` and `trip` are on. Detection, api, voice, and gps stay mock until those pieces are ready.
