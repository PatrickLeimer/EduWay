# recorder/ — Dev-only drive recorder

**Owner:** Julio (tuning and validation tooling; not one of WS1–WS4). Screen: `src/ui/dev/DriveRecorderScreen.tsx` (Dev menu → "Drive recorder"). Replay script: `scripts/drive-replay/`. User guide: `docs/drive-recording.md`.

## What it does
Records a test drive to an NDJSON file on the phone for threshold tuning and validation (master doc §9: "a dev-only recorder can save motion data to a local file on the tester's phone (never uploaded)"). It runs its own copy of the REAL detection and road modules, whatever `wiring.ts` says, and saves raw motion samples, GPS fixes, Overpass responses, live events, and passenger markers. `scripts/drive-replay` replays the file through the same detectors on a laptop.

## Must not
- Upload anything, or be reachable outside the Dev menu. Files leave the phone only through the share sheet.
- Change detector behavior. It consumes the public factories only (`detection/`, `road/`, `trip/` index files).
- Be used by the trip session or any product screen.

## Files
| File | What |
|---|---|
| `format.ts` | File format, marker and segment definitions, parser. Pure; shared with `scripts/drive-replay`. Bump `RECORDING_VERSION` on breaking changes. |
| `DriveRecorder.ts` | Recorder core. Pure, all sensors injected; tested in `DriveRecorder.test.ts`. |
| `expo.ts` | Real sensors, `expo-file-system` file, `expo-sharing` share sheet. |

## Known coupling
- `expo.ts` duplicates the Overpass URL and request from `road/OverpassRoadCache.ts` (road/ does not export its fetcher). Keep them in sync.
- `scripts/drive-replay/analyze.ts` imports detector internals (`detection/level1.ts`, `signals.ts`, `MotionDetector.ts`, `road/OverpassRoadCache.ts`, `RoadEventDetector.ts`) because the module index files also export Expo adapters that cannot load in Node. If WS1/WS2 rename those files, update the imports there.
