# Kickoff prompt for Cursor

> **Cursor agents only.** Claude Code agents use [`KICKOFF_PROMPT.md`](./KICKOFF_PROMPT.md). Do not treat this file as that prompt, and do not commit a `scaffold` branch from it. The scaffold this prompt describes is already in the repo.

This is the Cursor adaptation of the Claude Code kickoff. Product rules still come from the root `CLAUDE.md` (Cursor loads it as a workspace rule) and `docs/driving-coach-master.md`. When you touch Expo or React Native APIs, also follow `apps/mobile/AGENTS.md`: read the installed Expo SDK version and the matching versioned docs before writing that code. Root `CLAUDE.md` wins if they disagree about product scope.

## Map and road data — keep both visible

The demo has to show **Google Maps** and **the other road data** together. Do not treat the map as a later decoration, and do not collapse road data into the map SDK.

- **Google Maps APIs** (`react-native-maps`, master doc §2, §8 "Display", §12): the route polyline, the car, and event pins. The UI phase draws them. Until then, every trace point and event location you store is a point that map will plot.
- **Other road data** (OpenStreetMap via the Overpass API, master doc §8): street name, road class, speed limit (posted vs inferred), and stop signs. WS2's cache and way match produce this. It is what the map labels and what speeding / rolling stops use.
- Show `© OpenStreetMap contributors` wherever OSM fields (street, limit, class) appear.
- Do not replace that road data with Google Roads, Google Places, Mapbox, MapLibre, TomTom, HERE, or Valhalla. Google Maps is the map. OSM is the road data. Both stay.

## How Cursor differs from the Claude Code kickoff

- Do not paste this into Claude Code, and do not redo the scaffold. Read the repo and extend the workstream you were assigned in `docs/workstreams.md`.
- Plan mode in Cursor is optional. Use it before a large or cross-workstream change. Do not stop for approval on work the user already assigned.
- Do not commit unless the user asks. Never commit to `main`. Branch names stay `ws1/…`, `ws2/…`, `ws3/…`, `ws4/…`, `ui/…`.
- Do not edit protected contracts (`packages/shared/src/**`, `apps/mobile/src/contracts/**`, `server/src/coach/types.ts`) unless the task says so. If you need a contract change, stop and describe it.
- Edit only your workstream's paths (root `CLAUDE.md` ownership table). `apps/mobile/src/wiring.ts` is WS2's; other workstreams ask before touching it.
- Run `npm run typecheck` and `npm test` from the repo root before saying the task is done. Format only the files you changed (`npx prettier --write <paths>`).
- Put detection, road, scoring, and summary logic in pure functions. The only files that may import `expo-*` or `react-native` inside a logic module are the thin adapters. Vitest runs in Node and must not load those adapters.

## Step 1: Read first

1. Root `CLAUDE.md` (already applied in Cursor). Its rules apply to everything you do.
2. `docs/driving-coach-master.md`. It is the source of truth for the product, data model, events, thresholds, and architecture.
3. `docs/workstreams.md` for the workstream you were assigned: owned paths, contracts, mocks, and the ordered task list.
4. The folder `CLAUDE.md` inside the modules you will edit.
5. Look through the repo and reuse what is there. Stubs are marked `TODO(<workstream>)`. Do not recreate the scaffold.

## Step 2: Confirm scope

Before editing, note:

- Which workstream you are, and the paths you will touch
- Which modules stay on mocks (`apps/mobile/src/wiring.ts` flags, server `USE_REAL_*` env flags)
- Any conflict between `CLAUDE.md`, the master doc, `workstreams.md`, and the task

If the task crosses workstreams or needs a contract change, stop and ask. Otherwise implement.

## Step 3: Build only the assigned work

The tree below is the existing scaffold. Do not rebuild it. Implement real logic inside your workstream, keep stubs out of other people's folders, and leave their `USE_REAL` flags alone.

```
/
├── CLAUDE.md
├── docs/
│   ├── driving-coach-master.md
│   ├── KICKOFF_PROMPT.md            # Claude Code agents
│   ├── KICKOFF_PROMPT_CURSOR.md     # this file — Cursor agents
│   └── workstreams.md
├── packages/shared/src/             # protected contracts
├── apps/mobile/src/
│   ├── contracts/                   # protected contracts
│   ├── wiring.ts                    # WS2 — mock vs real flags
│   ├── detection/                   # WS1
│   ├── road/                        # WS2
│   ├── trip/                        # WS2
│   ├── api/                         # WS3
│   ├── voice/                       # WS4
│   └── ui/                          # placeholders; each WS owns only its dev/WsNDebug.tsx
├── server/src/                      # WS3, except coach/ which is WS4
└── scripts/alert-clips/             # WS4
```

Shared rules that still hold:

- Thresholds live in `packages/shared/src/thresholds.ts`. Do not hard-code them.
- Code against `contracts/`. Use another module's mock until that workstream flips its own flag.
- Import another workstream only through its public `index.ts`.
- UI stays plain `View`, `Text`, `Button`, and `ScrollView` until the UI phase. No logic in `ui/`.
- Do not build anything in root `CLAUDE.md` "Out of scope" or master doc §19.

## Step 4: Verify and stop

1. `npm run typecheck` and `npm test` pass.
2. Do not commit unless the user asked.
3. Summarize what you changed, which flags you flipped, and any open decision from `docs/workstreams.md` you did not resolve.

Do not implement another workstream's tasks while you are here.
