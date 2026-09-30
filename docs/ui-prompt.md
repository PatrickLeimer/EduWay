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
- Screens get data only from `trip/` (`useTripState`, `useMapGps`, `TripSession` methods), `api/` (`useApiQuery`, `ApiClient`), and the `DebriefPlayer` contract on `modules.debrief` (voice playback and progress on the coach screen, §12 screen 3).
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
| `good` / `goodSoft` | `#1E8E3E` / `#E6F4EA` | Success states; coach strength chips |
| `driveBg` / `drivePanel` / `driveBorder` | `#0B0F14` / `#161B22` / `#2A313C` | Driving mode (always dark) |

Type: system font. Speed number 96 pt; driving-mode text at least 20 pt; driving buttons at least 64 pt tall (`DRIVE_BUTTON_HEIGHT`). Radius 8–24, soft shadow (`shadow`). `SAFE_TOP`/`SAFE_BOTTOM` pad content away from the notch because there is no safe-area library.

## 3. Screens and flows

```
Home ──Drive──▶ Driving ──End (stopped 30 s)──▶ Trip concluded ──Next──▶ Replay ─▶ Infractions ─▶ Driving growth ─▶ Your coach ──Done──▶ Home
 │                                                                         ▲
 ├─Past drives──▶ trip cards ──tap─────────────────────────────────────────┘  (Done returns to Past drives)
 ├─Progress
 └─Settings ──Developer tools──▶ Dev menu (WS1–WS4 debug screens, drive recorder)
```

Navigation is state-based (`ui/navigation.ts`, `ui/Root.tsx`). Routes: `start`, `driving`, `ended`, `replay` / `infractions` / `growth` / `coach` `{tripId, origin}`, `list`, `progress`, `settings`, plus the dev routes. Dev screens keep the old plain scrolling wrapper.

### Home / Start drive: `screens/StartDriveScreen.tsx` (§12.1)
- Full-screen map following your location (`useMapGps`).
- Uber-style sheet: **"Where to?"** field + **Directions** opens Google Maps driving directions through a public Maps URL (`lib/links.ts`, no API key, no Directions API). Hint text tells the driver to start directions there before driving; Google Maps keeps giving voice directions in the background.
- Toggles: **Driving lock** (default from Settings) and **I'm a passenger** (§4).
- Big black **Drive** button → `trip.start({ lockEnabled, passenger })` → Driving.
- Buttons for Past drives, Progress and Settings.

### Driving mode: `screens/DrivingScreen.tsx` (§12.2, §4, §7, §16)
- Always dark and nearly blank. **No map** while driving (the map is shown only in Replay), and no speed, speed limit, street or distance.
- Shows only: the **trip time** (96 pt) and a big **stop sign** (`components/StopSign.tsx`, drawn with Views) with **"EYES ON THE ROAD"** under it.
- **No event list and no visual alerts.** The stop sign is a static reminder, not an alert. Live alerts are voice only (§7).
- **End drive** is hidden until the car has been stopped for 30+ s (`canEnd()`), then appears at the bottom (§4).
- Every touch on the screen (outside the top bar) calls `trip.reportTouch()` (phone-use detection, §7).
- **Emergency 911** (asks to confirm, then dials) and **Directions** (opens Google Maps) sit in a separate top bar *outside* the touch-reporting view, so they are not reported as phone use (§4, §7 "other than emergency or navigation").
- The Android back button is blocked while driving.
- When the trip starts uploading → Drive complete. If starting fails → error with Back to home.

### Post-trip flow (§12.3): `lib/flow.ts`
One screen at a time, each with step dots and a big **Next** (`components/FlowFooter.tsx`); Back goes to the previous step. The flow remembers where it started (`origin`): the drive that just ended finishes on **Home** (and resets the session), a past drive finishes on **Past drives**. Every step loads the trip with `api.getTrip(tripId)`.

### Trip concluded: `screens/TripEndedScreen.tsx`
- Big loading state while the trip uploads and the server scores and coaches it: a breathing blue ring around a large spinner and the server's stages in order ("Saving your route… Scoring your drive… Your coach is reviewing your drive…").
- Done → **score reveal** (large `ScoreRing`, "not scored" for passenger trips), distance and time, then **Next** → Replay. Queued (offline) → "saved on this phone, will upload automatically" + Back to home. Error → message + Back to home.
- No map (the route is only shown in Replay).

### Replay: `screens/ReplayScreen.tsx` (§9 "Replay"), flow step 1
- Full route line (`api.getTrace`), a car dot interpolated along it (`lib/replay.ts positionAt`), event pins that appear once playback reaches their timestamp, and a "just happened" event card.
- Timeline: speed bars (48 buckets) with event ticks and a playhead. **Tap the timeline to seek.** Play/Pause, **1x / 4x / 10x**.
- The only screen with a map in the drive flow. Next works while loading, so a missing trace never traps the user.

### Infractions: `screens/InfractionsScreen.tsx`, flow step 2
- Summary card: the number of things to work on, split into serious (harsh) and minor (coach). Zero → "Clean drive".
- Every event in time order (`EventRow`): minutes into the drive, street, speed, limit, "voice alert played". OSM credit.

### Driving growth: `screens/GrowthScreen.tsx`, flow step 3
- **Placeholder** for the future game-style progress: a blue "Coming soon" hero (level badge, empty progress track) and locked badge ideas (Smooth Stopper, Phone-Free Streak, Speed Keeper, Road Test Ready). Nothing is computed yet: no invented numbers (rule in §1).

### Your coach: `screens/CoachScreen.tsx` (§10, §11), flow step 4
- The Gemini coaching as a **chat**: header with the coach's avatar and name (**Coach Chris**, the ElevenLabs voice), live status ("Talking…" with sound bars, "Paused", "Finished"). Messages appear as left-aligned bubbles on a light gray background; a typing indicator shows just before each one. The student only listens; there is no input.
- **Voice sync:** the ElevenLabs debrief (`modules.debrief`) starts automatically; each bubble appears when the voice starts saying it, using `CoachOutput.chat_audio_starts_s` from the server (fallbacks in `lib/chat.ts`: spread by length over the audio, or a reading pace with no audio). If the audio doesn't start within 8 s, the chat plays out at reading pace.
- **Street View card** (§12, `components/StreetViewCard.tsx`): when the debrief has a `streetView` callout, a card appears once the coach finishes: street name, the thumbnail from our backend, and Gemini's caption. Tap → full-screen `react-native-webview` panorama (our `/streetview/:tripId/panorama` page) with Close and the caption. Loading placeholder; if the image or panorama fails, the caption stays with "Street View isn't available right now." No callout → nothing.
- Controls: **Pause/Resume**, **Replay**, **Show all**. When the coach finishes, a **Your takeaways** card shows the focus areas (skill + tip) and strength chips.
- Passenger trip → one friendly bubble explaining there's nothing to coach. No coaching (Gemini busy or out of quota) → a bubble saying so and a **Try again** button (`api.retryCoaching`, `POST /trips/:id/coach`); on success the chat and voice start as usual, on failure the bubble asks to try again in a minute. **Done** → Home (or Past drives).
- Older trips without `chat` use the short summary split into sentences.

### Past drives: `screens/TripListScreen.tsx`
- Uber-style cards: static route preview (`routePreview`, Android `liteMode`), date, distance, duration, event count, score. Tap → the post-trip flow (Replay first).

### Progress: `screens/ProgressScreen.tsx` (§12.5)
- Test-readiness card, score trend (plain bars, no chart library), per-skill totals and per-10-mi rates, recurring spots on a map + list. All numbers come from `GET /progress`.

### Settings: `screens/SettingsScreen.tsx` (§12.6)
- Driving lock on by default (in memory, see gaps). **Test drive (simulated)** switch. About text (privacy + §16 disclaimer). **Developer tools** → dev menu.

### Test drive mode (presentations)
- Off by default: the app uses real GPS, sensors, server and voice (`wiring.ts USE_REAL`).
- On (Settings or Developer tools): the next drive uses `wiring.ts DEMO_FLAGS`. GPS replays the recorded ~3-minute fixture drive (Miami) and detection replays its events, while road data, voice alerts and the server stay real (`DEMO_FLAGS.api` is true). You get real alert clips and real Gemini coaching on the synthetic drive with the phone sitting on a table. The phone must reach `EXPO_PUBLIC_API_URL`; if it can't, the trip is queued instead. The fixture ends parked for 35 s, so **End drive** unlocks at the end.
- `Root.tsx` swaps to `getDemoModules()` while the switch is on. The switch is locked while a trip is running. Home and Driving show a yellow **TEST DRIVE** badge.
- Test drives upload to the server like real ones, so they appear in Past drives and Progress.

### Developer tools: `screens/DevMenuScreen.tsx`
- Mode: the Test drive switch + each module's current source (real / simulated; simulated shown in amber).
- Server: the API URL in use (warns when it's `localhost` on a phone) and **Test connection** (calls `listTrips`, shows latency or the error).
- Live trip: status, error, GPS position, speed/accuracy, OSM road match + limit confidence, event count, trace fixes, distance, stopped-for seconds.
- Links to the drive recorder and WS1–WS4 debug screens (these return to Developer tools).

### How maps work (and which Google APIs)
- **Basemap:** `react-native-maps` `MapView`, native on both phones. **Android:** the **Google Maps SDK for Android** (Expo Go ships with its own key; a development/EAS build needs our own key in `app.json`, see the SDK 57 `react-native-maps` docs). **iPhone:** **Apple Maps** (MapKit, no key). No WebView map and no Maps JavaScript API key in the app.
- **What we draw on it:** our own recorded GPS trace (route line), event locations (pins), and the car dot. No Google service computes these.
- **Street names and speed limits:** OpenStreetMap via Overpass (WS2), not Google.
- **Directions:** a plain Google Maps link (`google.com/maps/dir/?api=1…`) that opens the Maps app. No API key, no Directions API.
- **Not used (banned by root `CLAUDE.md`):** Google Roads, Google Places, and other map providers.

## 4. Components (`ui/components/`)

| Component | What it is |
|---|---|
| `MapCanvas.tsx` | The only map screens import. Phones → `NativeMapCanvas.tsx` (Google Maps SDK on Android, Apple Maps on iPhone). Props: `route`, `pins`, `car`, `follow`, `fitTo`, `interactive`, `dark`, `lite`. |
| `NativeMapCanvas.tsx` | `react-native-maps` implementation: `PROVIDER_GOOGLE` on Android, Apple Maps on iPhone. Android dark style is `mapDarkStyle` in `theme.ts`; iPhone uses the system dark map. |
| `MapCanvas.web.tsx` | Browser version: a keyless Google Maps embed centered on the car or route; no route line or pins. |
| `Screen.tsx` | Light-screen shell: `BackButton` (rounded pill with a drawn chevron, springs when pressed), large title, optional edge-to-edge `hero` (map), scrolling body, pinned `footer`. Title, hero, body and footer enter one after another. |
| `Button.tsx` | `primary` (black), `secondary` (gray), `danger` (red), `onDark` (driving); `large` for in-car sizes. Shrinks slightly while held. |
| `motion.tsx` | `FadeIn`, `ScreenTransition`, `PressableScale`, `GrowBar`, `staggerDelay`, `useReducedMotion` (see Motion below). |
| `ConnectionError.tsx` | Friendly "Can't reach the server" card with the URL tried, a pointer to Developer tools, and Try again. |
| `primitives.tsx` | `Card`, `SectionTitle`, `Muted`, `StatTile`, `ToggleRow`, `OsmCredit`, `TierDot`. |
| `TestDriveToggle.tsx` / `TestDriveBadge.tsx` | Test drive switch (locked mid-trip) and the yellow badge. |
| `ScoreRing.tsx` | Score badge (neutral color on purpose). |
| `SpeedLimitSign.tsx` | US speed-limit sign; never changes color. |
| `FlowFooter.tsx` | Step dots + big Next/Done for the post-trip flow. |
| `StopSign.tsx` | Red octagon stop sign drawn with plain Views (a square clipped by the same square turned 45°), used on the Driving screen. |
| `EventRow.tsx` | One event: tier dot, label, street, speed, limit, "voice alert played". |

Helpers (`ui/lib/`, all tested): `format.ts` (labels, mph, clock, durations, dates), `geo.ts` (GeoJSON ↔ map points, fit region), `replay.ts` (position at time, event offsets, speed buckets), `links.ts` (directions URL, emergency number), `transitions.ts` (which way a screen change animates), `flow.ts` (post-trip step order, Next/Back targets), `chat.ts` (when each coach bubble appears).

### Motion

Built on React Native's `Animated` API (no library), native driver, cubic ease-out. Timings are `motion` in `theme.ts`. With the OS "Reduce motion" setting on, everything appears without movement.

| Where | What moves |
|---|---|
| Every screen change (`Root.tsx`) | Deeper screen slides in from the right, going back slides in from the left, driving mode rises in, same-level screens cross-fade (`lib/transitions.ts`). The backdrop matches the incoming screen so nothing flashes. |
| Every light screen | Title, then map, then content, then footer enter in sequence. |
| Buttons, cards, back button | Shrink while held, spring back on release. |
| Home | Sheet slides up over the map; top bar drops in. |
| Driving | Trip time fades in, then the stop sign settles in; End drive rises in once allowed (nothing moves while driving beyond that). |
| Trip concluded | Ring breathes behind the spinner; each stage fades in; the score pops in. |
| Past drives | Cards glide up one after another (staggered, capped at 8). |
| Infractions / Growth | Summary card scales in; rows and badges stagger in. |
| Your coach | Each bubble fades up as it's spoken; typing dots pulse; sound bars move while talking; takeaways slide in at the end. |
| Replay | Speed bars grow left to right; each new event card pops in. |
| Progress | Score bars grow up, skill rows stagger in. |

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

1. **Leaving the app for Google Maps while driving.** Once EduWay is backgrounded, sensors stop reading reliably and (lock off) it counts as phone use. This is §18 flag 2 and needs a team decision. The UI keeps Directions available as §4 requires.
2. **Speed vs limit timeline** (§9 Replay): the trace stores speed only, so the replay shows speed + event ticks. A per-second limit needs a trace contract change (WS2/WS3).
3. **Delete trip** (§16 [Proposed]): no endpoint in the `ApiClient` contract, so it's not in Settings.
4. **Settings persistence:** in memory only; resets when the app restarts. Needs a storage choice (AsyncStorage would be a new dependency; `expo-file-system` is approved).
6. **Dependencies to approve if wanted:** Expo Router (`AGENTS.md` expects it in the UI phase), `@gorhom/bottom-sheet` (+ reanimated, gesture-handler) for a draggable sheet, `react-native-safe-area-context` for exact notch padding, an icon set.
6. **Emergency number** is `911` (`ui/lib/links.ts`). Change it if the demo is outside the US.
7. **Web preview:** the project has no `react-native-web`/`react-dom`, so `expo start --web` doesn't run. `MapCanvas.web.tsx` is ready for when it does.
8. **Ask the coach** (§10 stretch) has no screen yet; `api.ask` exists.
