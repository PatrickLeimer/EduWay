# Kickoff prompt for Claude Code

Setup before running: put `CLAUDE.md` at the repo root and the master doc at `docs/driving-coach-master.md`. Then paste everything below the line into Claude Code, ideally in plan mode.

---

You are setting up the starting scaffold for our hackathon project. Four developers will build on top of it in parallel, so the goal is a clean structure with clear boundaries, not features.

## Step 1: Read first

1. Read `CLAUDE.md` fully. Its rules apply to everything you do.
2. Read `docs/driving-coach-master.md` fully. It is the source of truth for the product, data model, events, thresholds, and architecture.
3. Look through the repo to see what already exists. Reuse anything that fits the structure below instead of recreating it.

## Step 2: Plan and wait for approval

Before creating any files, show me:

- The full folder tree you will create
- Every contract file with the types and interfaces you plan to put in it
- Any conflicts or gaps you found between `CLAUDE.md`, the master doc, and this prompt, with your proposed resolution
- Any questions

Then stop and wait for my approval.

## Step 3: Build the scaffold

### Structure

```
/
├── CLAUDE.md
├── docs/
│   ├── driving-coach-master.md
│   └── workstreams.md
├── package.json                  # npm workspaces, root scripts
├── tsconfig.base.json            # strict
├── .prettierrc                   # shared formatting to avoid merge noise
├── fixtures/                     # JSON test data shared by all workstreams
├── packages/shared/src/
│   ├── types.ts                  # Trip, Event, Trace, TripSummary, CoachOutput, etc.
│   ├── api.ts                    # zod schemas for every request and response
│   ├── thresholds.ts             # all thresholds from master doc section 7
│   └── index.ts
├── apps/mobile/
│   ├── App.tsx                   # renders ui/ only
│   └── src/
│       ├── contracts/            # module interfaces, one file per boundary
│       ├── wiring.ts             # picks real or mock implementation per module
│       ├── detection/            # WS1
│       ├── road/                 # WS2
│       ├── trip/                 # WS2
│       ├── api/                  # WS3
│       ├── voice/                # WS4
│       └── ui/                   # placeholder screens + dev/Ws1Debug..Ws4Debug
├── server/
│   ├── .env.example
│   └── src/
│       ├── index.ts
│       ├── routes/               # WS3
│       ├── db/                   # WS3
│       ├── scoring/              # WS3
│       └── coach/                # WS4
└── scripts/alert-clips/          # WS4
```

Adjust the details if the plan in Step 2 found a better fit, but keep the workstream boundaries from `CLAUDE.md`.

### Shared contracts

- `packages/shared`: write the real types and zod schemas from the master doc (sections 7, 9, 10, and 13): event types and tiers, limit confidence, trips, events, traces (columnar arrays), the Gemini trip summary input, the coaching JSON output, and every API endpoint's request and response.
- `apps/mobile/src/contracts/`: one interface per module boundary, for example:
  - Detection: consumes motion samples and GPS fixes, emits events
  - Road: road cache lookup for a GPS fix (street, road class, limit, confidence), plus speeding and rolling stop detectors
  - Voice: play an alert type, with cooldown handled inside
  - Trip: start, end (with the stopped for 30+ s rule), current events, trace, upload status
  - API client: one function per endpoint
- Add a short comment on each type pointing to the master doc section it comes from.

### Modules

For every module (detection, road, trip, api, voice, and on the server routes, db, scoring, coach):

- `index.ts` exporting only the public interface
- A stub implementation that satisfies the contract with `TODO` comments referencing the master doc section to implement. Do not implement the real logic.
- A `mocks/` folder with a mock implementation that returns realistic fake data from `fixtures/`, so other workstreams can build against it today.
- A folder-level `CLAUDE.md` with: owner workstream, what this module does, what it must not do, the contracts it implements and consumes, and a "done means" checklist taken from the weekend plan in the master doc.
- One placeholder Vitest test for the pure logic, so the test setup is proven to work.

`wiring.ts` should default every module to its mock, with one flag per module to switch to the real implementation.

### Server

- Express app with the endpoints from master doc section 13, each returning mock data validated against the shared zod schemas.
- MongoDB connection module and a setup script that creates the collections and indexes from section 9 (including the 2dsphere index on `events.location` and the unique index on `traces.tripId`). It should run against a real `MONGODB_URI` when one is provided.
- `server/.env.example` with `MONGODB_URI`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `PORT`.

### UI (minimal only)

- Plain React Native components, no styling or libraries.
- Screens: Start Drive, Driving (shows live events as plain text, End Trip button), Trip Result (score and coaching as plain text or JSON), Trip List, and a Dev Menu linking to `Ws1Debug` through `Ws4Debug`.
- Screens only call functions or hooks from `trip/` and `api/`. No logic in `ui/`.
- Simple state-based navigation, no navigation library.
- Leave a `ui/README.md` explaining that the real UI will be built in a later phase by separate agents, and that screens must stay thin.

### Fixtures

In `fixtures/`, create small realistic JSON samples: a GPS trace for a short drive, a list of events covering every event type and tier, a trip summary for Gemini, a coaching output, and an Overpass response with ways and stop signs.

### docs/workstreams.md

For each workstream (WS1 to WS4, plus UI later): owned paths, contracts it implements, contracts it consumes, mocks it can rely on, and an ordered task list for the weekend based on the master doc. Point out which tasks depend on another workstream and how the mocks unblock them.

### Root scripts

`npm run typecheck`, `npm test`, `npm run format`, `npm run dev:server`, `npm run dev:mobile`, `npm run db:setup`.

## Step 4: Verify and stop

1. Run `npm install`, `npm run typecheck`, and `npm test`. All must pass.
2. Confirm the server starts and a request to each endpoint returns valid mock data.
3. Confirm the Expo app starts and every placeholder screen renders using mocks only.
4. Commit everything on a branch named `scaffold`.
5. Give me a short summary: the tree, anything you changed from the plan, and anything that still needs a decision.

Do not implement any real feature logic. Do not add anything listed as out of scope in `CLAUDE.md`. Stop after the summary.
