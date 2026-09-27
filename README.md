# EduDriver (ShellHacks)

Phone-only driving coach for student drivers: live detection of driving mistakes, instant voice alerts for dangerous ones, and a Gemini + ElevenLabs voice debrief after every trip.

- Product and technical source of truth: [docs/driving-coach-master.md](docs/driving-coach-master.md)
- Rules for every contributor and agent: [CLAUDE.md](CLAUDE.md)
- Who owns what and the weekend task lists: [docs/workstreams.md](docs/workstreams.md)

## Layout

```
packages/shared   @edudriver/shared    types, API zod schemas, thresholds (protected contracts)
fixtures          @edudriver/fixtures  shared JSON test data, schema-checked on import
apps/mobile       @edudriver/mobile    Expo app (contracts/, wiring.ts, detection/, road/, trip/, api/, voice/, ui/)
server            @edudriver/server    Express API (routes/, db/, scoring/, coach/)
scripts/alert-clips                    ElevenLabs clip generator for live alerts
```

Every module ships a mock. The app and server run end to end on mocks with no keys; switch modules to real in `apps/mobile/src/wiring.ts` and `server/.env`.

## Development

Requires **Node 22** (see [.nvmrc](.nvmrc)). Run everything from the repo root.

```bash
npm install
npm run dev:server     # API on http://localhost:4000 (mocks unless server/.env says otherwise)
npm run dev:mobile     # Expo dev server; open in a development build or Expo Go
npm run db:setup       # create MongoDB collections + indexes (needs MONGODB_URI in server/.env)
npm run alert-clips    # generate live alert clips (WS4)
```

Copy `server/.env.example` → `server/.env` and `apps/mobile/.env.example` → `apps/mobile/.env` as needed. Secrets live only in `server/.env`.

Native modules in use (expo-sensors, expo-location, expo-keep-awake, expo-audio) are in Expo Go; if a later dependency is not, build a development client (`npx expo run:android|ios` or `eas build --profile development`).

## Demo build (EAS Update + Expo Go)

Publishes the JS bundle so anyone with Expo Go (SDK 57) can scan a QR code and run the app, no dev server needed. `runtimeVersion` uses the `sdkVersion` policy so updates stay Expo Go compatible.

One-time setup (from `apps/mobile`, logged in to the team's Expo account):

```bash
npx eas-cli@latest login
npx eas-cli@latest init                 # adds extra.eas.projectId + owner to app.json
npx eas-cli@latest update:configure     # adds updates.url to app.json
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://<deployed-server> --environment preview --visibility plaintext
```

Publish (from the repo root): `npm run publish:demo --workspace @edudriver/mobile`. The command prints an expo.dev link; that update page has the Expo Go QR code. `eas update --environment` ignores `apps/mobile/.env`, so public vars must be set with `eas env:set`.

## Checks (same as CI)

```bash
npm run typecheck
npm test               # Vitest: shared, fixtures, mobile pure logic, server, scripts
npm run lint           # expo lint, incl. module-boundary rules
npm run format:check   # npm run format to fix
(cd apps/mobile && npx expo-doctor)
```

## Branch workflow

Branch per workstream task (`ws1/<name>` … `ws4/<name>`, `ui/<name>`), open a pull request to `main`, and wait for the **`ci`** check to pass before merging. Contract changes go in their own small commit.

Repo admins: enable branch protection on `main` using [.github/BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md) (required status check: **`ci`**).
