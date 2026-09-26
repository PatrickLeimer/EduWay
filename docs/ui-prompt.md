# UI: how the frontend is built (and how to redo it)

This doc records every UI decision so the frontend can be changed or rebuilt
without touching the logic modules. It is also a prompt: hand sections 1–5 to an
agent to rebuild the UI in a different style.

Source of truth stays `docs/driving-coach-master.md`. Where this doc and the
master doc disagree, the master doc wins.

---

## 1. Rules the UI follows

- Only `apps/mobile/src/ui/**` changes. No edits to contracts, `wiring.ts`, or other workstreams.
- **No new dependencies.** Everything is React Native core + `react-native-maps` (approved) + `expo-status-bar` (already installed). Expo Router, a bottom-sheet library, an icon set, SVG and custom fonts all need team approval first (root `CLAUDE.md`).
- Screens get data only from `trip/` (`useTripState`, `useMapGps`, `TripSession` methods), `api/` (`useApiQuery`, `ApiClient`), and the `DebriefPlayer` contract on `modules.debrief` (voice playback on the debrief screen, §12 screen 3).
- Pure display helpers (formatting, map math, replay math, link builders) live in `ui/lib/` with Vitest tests. No detection, scoring or threshold logic in `ui/`.
- No new thresholds: nothing in the UI changes color based on a number it invents (e.g. the score ring has no good/bad bands).
- `© OpenStreetMap contributors` appears on every screen that shows street names or speed limits (§8).

## 2. Style

Direction: **Google Maps + Uber.**

- From Google Maps: map-first screens, floating controls, the speed-limit sign, a calm dark driving mode, and the blue route line and location dot.
- From Uber: a black/white/gray base, a big solid-black primary button, a "Where to?" field on a bottom sheet, trip history cards with a route preview, and a receipt-style debrief.

All tokens live in **`ui/theme.ts`**. Change the look there first.

| Token | Value | Used for |
|---|---|---|
| `black` / `white` | `#000000` / `#FFFFFF` | Base, primary buttons |
| `surfaceAlt` / `border` | `#F3F3F3` / `#E2E2E2` | Secondary buttons, tiles, dividers |
| `textMuted` | `#6B6B6B` | Secondary text |
| `route` / `location` | `#1A73E8` (Maps blue) | Route line and car dot only |
| `coach` / `harsh` | `#F9AB00` / `#D93025` | Event severity (tier), danger buttons |
| `good` | `#1E8E3E` | Reserved for success states |
| `driveBg` / `drivePanel` / `driveBorder` | `#0B0F14` / `#161B22` / `#2A313C` | Driving mode (always dark) |

Type: system font. Speed number 96 pt; driving-mode text at least 20 pt; driving buttons at least 64 pt tall (`DRIVE_BUTTON_HEIGHT`). Radius 8–24, soft shadow (`shadow`). `SAFE_TOP`/`SAFE_BOTTOM` pad content away from the notch because there is no safe-area library.

## 3. Screens and flows

```
Home ──Drive──▶ Driving ──End (stopped 30 s)──▶ Drive complete ──Get feedback──▶ Feedback ──Watch replay──▶ Replay
 │                                                                                 ▲
 ├─Past drives──▶ trip cards ──tap───────────────────────────────────────────────────┘
 ├─Progress
 └─Settings ──Developer tools──▶ Dev menu (WS1–WS4 debug screens, drive recorder)
```

Navigation is state-based (`ui/navigation.ts`, `ui/Root.tsx`). Routes: `start`, `driving`, `ended`, `result {tripId|null}`, `replay {tripId}`, `list`, `progress`, `settings`, plus the dev routes. Dev screens keep the old plain scrolling wrapper.

### Home / Start drive: `screens/StartDriveScreen.tsx` (§12.1)
- Full-screen map following your location (`useMapGps`).
- Uber-style sheet: **"Where to?"** field + **Directions** opens Google Maps driving directions through a public Maps URL (`lib/links.ts`, no API key, no Directions API). Hint text tells the driver to start directions there before driving; Google Maps keeps giving voice directions in the background.
- Toggles: **Driving lock** (default from Settings) and **I'm a passenger** (§4).
- Big black **Drive** button → `trip.start({ lockEnabled, passenger })` → Driving.
- Buttons for Past drives, Progress and Settings.

### Driving mode: `screens/DrivingScreen.tsx` (§12.2, §4, §7, §16)
- Always dark. A dark map follows the car and **can't be touched** (`interactive={false}`).
- Shows only: **speed** (large), **speed-limit sign** (from `latestRoad`; "est." when the limit is inferred), **street name**, **trip time**, **distance**, OSM credit.
- **No event list and no visual alerts.** Speed never turns red over the limit. Live alerts are voice only (§7).
- **End drive** is disabled and shows `canEnd().reason` until the car has been stopped for 30+ s (§4).
- Every touch on the map/HUD/End area calls `trip.reportTouch()` (phone-use detection, §7).
- **Emergency 911** (asks to confirm, then dials) and **Directions** (opens Google Maps) sit in a separate top bar *outside* the touch-reporting view, so they are not reported as phone use (§4, §7 "other than emergency or navigation").
- The Android back button is blocked while driving.
- When the trip starts uploading → Drive complete. If starting fails → error with Back to home.

### Drive complete: `screens/TripEndedScreen.tsx`
- The route just recorded (`trip.getTrace()`), distance and time.
- Uploading → spinner. Done → **Get feedback** button → Feedback. Queued (offline) → "saved on this phone, will upload automatically". Error → message + Back to home.
- The **voice debrief still starts automatically** when coaching arrives (§4; `TripSession` plays it). The button opens the written debrief; it does not gate the audio.

### Feedback / debrief: `screens/TripResultScreen.tsx` (§12.3)
- Receipt layout: route map with event pins → date → **score ring** (neutral black, "not scored" for passenger trips) + distance/time tiles → **Play/Stop voice debrief** (`modules.debrief`) → **What went well** → **Focus next time** cards (skill, why, tip) → event list → OSM credit → "Scores are a coaching tool, not a certification of safety" (§16).
- **Watch replay** pinned at the bottom.
- `tripId: null` = the trip that just ended (from `TripSession` state); Back resets the session and returns Home. With a tripId it loads from `api.getTrip`, and Back returns to Past drives.

### Replay: `screens/ReplayScreen.tsx` (§9 "Replay", §12.4)
- Full route line (`api.getTrace`), a car dot interpolated along it (`lib/replay.ts positionAt`), event pins that appear once playback reaches their timestamp, and a "just happened" event card.
- Timeline: speed bars (48 buckets) with event ticks and a playhead. **Tap the timeline to seek.** Play/Pause, **1x / 4x / 10x**.

### Past drives: `screens/TripListScreen.tsx`
- Uber-style cards: static route preview (`routePreview`, Android `liteMode`), date, distance, duration, event count, score. Tap → Feedback.

### Progress: `screens/ProgressScreen.tsx` (§12.5)
- Test-readiness card, score trend (plain bars, no chart library), per-skill totals and per-10-mi rates, recurring spots on a map + list. All numbers come from `GET /progress`.

### Settings: `screens/SettingsScreen.tsx` (§12.6)
- Driving lock on by default (in memory, see gaps). About text (privacy + §16 disclaimer). **Developer tools** → dev menu.

## 4. Components (`ui/components/`)

| Component | What it is |
|---|---|
| `MapCanvas.tsx` | The only map. Google Maps on Android, Apple Maps on iOS (Expo Go's iOS build has no Google key; same choice as `dev/Ws2Map.tsx`). Props: `route`, `pins`, `car`, `follow`, `fitTo`, `interactive`, `dark`, `lite`. |
| `MapCanvas.web.tsx` | Browser version: a keyless Google Maps embed centered on the car or route; no route line or pins. |
| `Screen.tsx` | Light-screen shell: back link, large title, optional edge-to-edge `hero` (map), scrolling body, pinned `footer`. |
| `Button.tsx` | `primary` (black), `secondary` (gray), `danger` (red), `onDark` (driving); `large` for in-car sizes. |
| `primitives.tsx` | `Card`, `SectionTitle`, `Muted`, `StatTile`, `ToggleRow`, `OsmCredit`, `TierDot`. |
| `ScoreRing.tsx` | Score badge (neutral color on purpose). |
| `SpeedLimitSign.tsx` | US speed-limit sign; never changes color. |
| `EventRow.tsx` | One event: tier dot, label, street, speed, limit, "voice alert played". |

Helpers (`ui/lib/`, all tested): `format.ts` (labels, mph, clock, durations, dates), `geo.ts` (GeoJSON ↔ map points, fit region), `replay.ts` (position at time, event offsets, speed buckets), `links.ts` (directions URL, emergency number).

## 5. How to redo the frontend

- **Restyle only:** edit `ui/theme.ts`, then the `StyleSheet`s at the bottom of each component/screen. No logic moves.
- **Replace a screen:** keep its data sources (listed per screen above) and its doc rules, and rewrite the JSX. Screens don't depend on each other except through `navigate()`.
- **Swap the map:** replace `MapCanvas.tsx` behind the same props. Master doc §8 fixes Google Maps via `react-native-maps` and bans Mapbox/MapLibre/etc.
- **Switch to Expo Router** (after the team approves the dependency): each `Route` becomes a file in `src/app/`; `ScreenProps.modules` can come from a context; `settings` moves to a context or storage.
- **Always keep:** the driving-screen rules in section 3 (no visuals for alerts, `reportTouch` wrapper, Emergency/Directions outside it, `canEnd` gating, no interactive map), OSM credit, and "logic stays out of `ui/`".
- Before calling it done: `npm run typecheck`, `npm test`, `npm run lint`, format the changed files.

## 6. Decisions made against the master doc

| Topic | Decision | Doc reference |
|---|---|---|
| Event log while driving | Not shown. Speed, limit, time, distance and the map only. | §7 "Voice only, never visual", §16 |
| Map while driving | Shown, dark, non-interactive. | §12.2 "minimal driving screen" |
| Directions | Open the Google Maps app (before the drive on Home; also available while driving). No in-app turn-by-turn. | §4 "navigation always stays available" |
| "Get feedback" button | Opens the written debrief; the voice debrief still auto-plays. | §4 "The voice debrief plays when the trip ends" |
| Speed over the limit | No color change. | §7 |
| Score colors | None (would be new thresholds). | root `CLAUDE.md` thresholds rule |

## 7. Open items for the team

1. **Leaving the app for Google Maps while driving.** Once EduDriver is backgrounded, sensors stop reading reliably and (lock off) it counts as phone use. This is §18 flag 2 and needs a team decision. The UI keeps Directions available as §4 requires.
2. **Speed vs limit timeline** (§9 Replay): the trace stores speed only, so the replay shows speed + event ticks. A per-second limit needs a trace contract change (WS2/WS3).
3. **Delete trip** (§16 [Proposed]): no endpoint in the `ApiClient` contract, so it's not in Settings.
4. **Settings persistence:** in memory only; resets when the app restarts. Needs a storage choice (AsyncStorage would be a new dependency; `expo-file-system` is approved).
5. **Dependencies to approve if wanted:** Expo Router (`AGENTS.md` expects it in the UI phase), `@gorhom/bottom-sheet` (+ reanimated, gesture-handler) for a draggable sheet, `react-native-safe-area-context` for exact notch padding, an icon set.
6. **Emergency number** is `911` (`ui/lib/links.ts`). Change it if the demo is outside the US.
7. **Web preview:** the project has no `react-native-web`/`react-dom`, so `expo start --web` doesn't run. `MapCanvas.web.tsx` is ready for when it does.
8. **Ask the coach** (§10 stretch) has no screen yet; `api.ask` exists.
