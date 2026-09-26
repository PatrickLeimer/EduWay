# Google Maps and OSM status (handoff note for WS2)

Checked against `main` at `62b1ddf` (after PR #4), 2026-09-26. Section numbers refer to `docs/driving-coach-master.md`.

## Google Maps: nothing built yet

| Item | Status | Notes |
|---|---|---|
| `react-native-maps` dependency | **Missing** | Approved in root `CLAUDE.md` but not in `apps/mobile/package.json`. Install with `npx expo install react-native-maps` from `apps/mobile`. |
| Map config / API keys | **Missing** | Nothing in `app.json`. Expo Go may be enough for a first test; a development or EAS build needs the Google Maps keys set up per the SDK 57 `react-native-maps` docs. Keys are for the map SDK only; don't use Google Roads or Places (§2). |
| Trip map: route polyline + event pins (§8 "Display", §12 screen 4) | **Missing** | No `MapView` anywhere. The data is ready: `trip.getTrace()` / `api.getTrace()` give the trace columns, and every event has `location` plus street, class, limit and confidence. |
| Replay: animated car, pins popping in by time, 1x/4x/10x (§9 "Replay") | **Missing** | |
| Speed vs limit timeline under the map (§9 "Replay") | **Missing, needs a decision** | The trace stores speed but **no speed limit per point**, and events only carry the limit where an event happened. Either add a limit column to the trace (contract change to `TraceUpload` and the `traces` schema) or work out another source. Raise with the team. |
| Route thumbnail in trip lists | Server side done | `routePreview` is built by the server (`server/src/routes/traceCodec.ts`); nothing on the phone draws it yet. |

**Ownership check:** the root `CLAUDE.md` says map display is **UI phase only** and `apps/mobile/src/ui/**` belongs to the UI workstream. If WS2 is building map screens now, agree on that with the team so it doesn't collide with the UI phase.

## OSM / Overpass: works on fixtures, open issues

### 1. Overpass reachability: verify on a phone (high priority)
From a development laptop on 2026-09-26, `https://overpass-api.de/api/interpreter` returned **HTTP 406 for every request**, including the app's exact query, a trivial query and `/api/status`, with or without a custom User-Agent. Two public mirrors (`overpass.kumi.systems`, `overpass.private.coffee`) returned **504** (overloaded). This may be specific to that network, but:
- The app has **one hard-coded endpoint and no fallback** (`road/overpass.ts` `OVERPASS_URL`). If it fails, speeding, rolling stops and street names are silently off for the whole trip. The only sign is `lastError` on the WS2 debug screen.
- **To check:** start the Drive recorder (Dev menu) on a phone, on mobile data. The Road line shows ways/stop signs or the HTTP error.
- **Suggested fix:** a list of endpoints tried in order, and a clear status on the debug screen.

### 2. No retry backoff after a failed fetch
Since PR #4 a failed fetch no longer blocks anything, but offline or when rate-limited the cache retries on **every GPS fix (1 per second)**. That can make Overpass rate-limit us (HTTP 429). A backoff needs a new tunable (suggested `ROAD.refetchBackoffS: 30`) in `packages/shared/src/thresholds.ts`, which is a protected contract, so agree on it first.

### 3. Duplicate rolling stops at intersections with several stop nodes
`fixtures/overpass.response.json` has stop nodes 2001 and 2002 about 10 m apart (a common OSM pattern: one node per approach). Replaying the fixture drive produced **two `rolling_stop` events at the same second** for one stop. `RoadEventDetector` keeps one window per node; it should merge signs that are within `ROLLING_STOP.signRadiusM` of each other, or emit at most one rolling stop per pass. Repro: `npm run drive-replay` on a recording built from the fixture trace (ask for the smoke file).

### 4. Smaller detector notes
- **Rolling stops can be missed:** at 1 Hz GPS and 30 mph the car moves about 13 m per fix, so it can pass a sign with no fix inside the 15 m radius. Tune `ROLLING_STOP.signRadiusM` from real drives (the recorder report shows this).
- **Speeding episodes split at way boundaries:** 5 s of speeding across two OSM ways can produce no event at all, because each way restarts the 5 s timer.
- **Harsh speeding can come from a single fix:** harsh is set if any one fix is +15 over a posted limit, not held.

### 5. Persistent offline queue (open decision 1 in `docs/workstreams.md`)
The upload queue is still in memory; trips queued offline are lost if the app is killed. `expo-file-system` is now an approved dependency (added for the Drive recorder), so it can be used for this.

### 6. OSM attribution on the driving screen
`ui/screens/DrivingScreen.tsx` shows street names from OSM without "© OpenStreetMap contributors" (§8 "Display"). It's a UI placeholder, but the rule applies wherever OSM data shows.

### 7. Demo route check (WS2 task 7, §8)
Not done yet. The Drive recorder report now prints, per drive, the % of fixes matched to a street and the % with a **posted** vs **inferred** limit. Use it to choose a demo route with posted limits.

### 8. Small request: export the Overpass fetcher
`recorder/expo.ts` duplicates the Overpass URL and request from `road/OverpassRoadCache.ts` because `road/index.ts` doesn't export it. Exporting `fetchOverpass` (or the URL list from item 1) would remove the copy.
