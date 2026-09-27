# CLAUDE.md

Rules for every Claude Code session in this repo. Read this fully before doing anything.

## The project

A phone-only driving coach for student drivers, built at a weekend hackathon by 4 developers working in parallel. The app detects driving events live on the phone, plays ElevenLabs voice alerts for dangerous ones, and after each trip gives a Gemini coaching debrief voiced by ElevenLabs, with a map replay of the route.

**Source of truth:** `docs/driving-coach-master.md`. Every product and technical decision is in there. Do not reinterpret, "improve," or override it. If the doc and a task disagree, stop and ask.

## Stack (fixed, do not change)

- Monorepo with npm workspaces, TypeScript strict everywhere
- `apps/mobile`: React Native with Expo
- `server`: Node.js + Express + TypeScript, deployed by the team
- `packages/shared`: data types, API contracts, and constants used by both
- MongoDB (official `mongodb` driver), Gemini (`@google/genai`), ElevenLabs
- Map display: Google Maps via `react-native-maps` (UI phase only)
- Road data: OpenStreetMap via the Overpass API
- Tests: Vitest for pure logic

## Workstreams and ownership

Each developer owns one workstream. Only edit files inside your workstream's paths.

| Workstream | Owns | Scope |
|---|---|---|
| WS1 Motion detection | `apps/mobile/src/detection/**` | DeviceMotion adapter, orientation, filtering, junk rejection, brake / accel / turn / swerve detectors, phone use detection |
| WS2 Road data + trip session | `apps/mobile/src/road/**`, `apps/mobile/src/trip/**`, `apps/mobile/src/wiring.ts` | Overpass cache, way matching, speed limits, speeding and rolling stop detectors, trip start/end, GPS trace recorder, offline queue, wiring modules together |
| WS3 Backend + data | `server/src/**` (except `coach/`), `apps/mobile/src/api/**` | Express API, MongoDB collections and indexes, trace storage, scoring, deployment, mobile API client |
| WS4 Coaching + voice | `server/src/coach/**`, `apps/mobile/src/voice/**`, `scripts/alert-clips/**` | Gemini summary and prompt, ElevenLabs debrief, pre-generated alert clips, live alert player and cooldown |
| UI | `apps/mobile/src/ui/**` | Screens, design tokens (`ui/theme.ts`), shared UI components (`ui/components/`), post-trip flow |

If you do not know which workstream the current task belongs to, ask before editing anything.

## Shared contracts (protected)

These files define how workstreams talk to each other:

- `packages/shared/src/**` (data types, API schemas, thresholds)
- `apps/mobile/src/contracts/**` (module interfaces)

Do not edit them unless the task explicitly says to. If your work needs a contract change, stop, describe the change and why, and let the developers agree on it first. Contract changes go in their own small commit, separate from feature work.

## Working against other workstreams

- Code against the interfaces in `contracts/`, never against another module's internals.
- Every module has a mock implementation in its `mocks/` folder. Use the other modules' mocks while they are unfinished. Switch between real and mock in `apps/mobile/src/wiring.ts` (WS2 owns it; other workstreams ask before editing).
- Never import from another workstream's folder except its public `index.ts`.

## UI rules

The app keeps its existing screen structure: Start drive → Driving → Trip concluded, then the post-trip flow (Replay → Infractions → Driving growth → Coaching chat, with Back/Next between pages, `ui/lib/flow.ts`), plus Past drives, Progress, Settings and the Dev menu. Do not restructure screens or navigation; restyle only through tokens and shared components.

**Look (teal design system on the existing structure)**
- `apps/mobile/src/ui/theme.ts` is the single source of truth for color, spacing, radius, type sizes and the lip. No raw hex values outside `theme.ts`.
- Teal is the main color (primary buttons, active states, route line, hero surfaces). Coral is rare and always means harsh-tier events or danger. Amber means coach-tier events. Pure `black`/`white` are only for road signs (`SpeedLimitSign`, `StopSign`).
- No gradients, glassmorphism, blur, glow, or soft drop shadows. Depth comes only from the "lip": a solid bottom border one shade darker (`lip`, `edge` in `theme.ts`).
- Lexend for all text: set `fontFamily: fonts.regular` or `fonts.semiBold` from `theme.ts`, never `fontWeight` (it breaks custom fonts on Android). No other font names outside `theme.ts`.
- Buttons are `components/Button.tsx` (chunky face on a lip that presses down). Cards are `Card` in `components/primitives.tsx` (white, hairline border, `lip` for the one hero card on a screen).
- Driving mode: dark theme (`drive*` colors), text at least 20, touch targets at least 64, and nothing the driver should read while moving.
- Show `© OpenStreetMap contributors` (`OsmCredit`) wherever OSM street names or limits appear.

**Boundaries**
- No logic in `ui/`. Screens call hooks or functions exported from `trip/` and `api/`. If a screen needs data that does not exist, stop and ask.
- Logic modules never import from `ui/`.
- Each workstream may edit only its own debug screen: `apps/mobile/src/ui/dev/Ws1Debug.tsx` through `Ws4Debug.tsx`.

## Out of scope (do not build, do not add hooks for)

- Parent or instructor views
- Turn signal detection
- OS-level phone locking, automatic trip start, background tracking
- Storing motion sensor data anywhere (only the 1 Hz GPS trace is stored; see master doc section 9)
- Valhalla, TomTom, HERE, Mapbox, MapLibre, Google Roads, Google Places
- Machine learning models for detection (rules only)
- Authentication beyond a simple user id [ask before adding]
- Anything in master doc section 19 ("Future")

## How to work

- Do exactly the task asked. No unrequested refactors, renames, reformatting of files you did not change, or "while I was here" fixes.
- Keep diffs small. If a change touches more than one workstream, stop and ask.
- Do not add dependencies without asking. Already approved: `expo-sensors`, `expo-location`, `expo-keep-awake`, `expo-audio`, `expo-file-system`, `expo-sharing`, `react-native-maps`, `pako`, `express`, `mongodb`, `zod`, `@google/genai`, `@elevenlabs/elevenlabs-js`, `dotenv`, `vitest`, `@expo-google-fonts/lexend`, `expo-font`.
- Put detection, road, scoring, and summary logic in pure functions with no React Native or Expo imports, so it can be tested with Vitest using JSON fixtures in `fixtures/`.
- Thresholds live in `packages/shared/src/thresholds.ts`. Never hard-code them elsewhere.
- Run `npm run typecheck` and `npm test` before saying a task is done.
- Run `npm run format` on files you changed only.
- When something is unclear, ask. Do not guess and build.

## Secrets

- API keys (Gemini, ElevenLabs, MongoDB URI) live only in `server/.env`. Never in the mobile app, never committed.
- Keep `server/.env.example` updated with variable names only.

## Git

- Branch per workstream task: `ws1/<short-name>`, `ws2/...`, `ws3/...`, `ws4/...`, `ui/...`.
- Never commit to `main` directly.
- Commit messages start with the workstream: `ws2: add Overpass cache refresh`.
