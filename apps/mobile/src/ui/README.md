# ui/ — placeholder screens

The real UI is built in a **later phase by separate agents**. Until then, everything in this folder is a placeholder that exists only to exercise the logic modules on a phone.

## Rules (root CLAUDE.md "UI rules")
- Plain `View`, `Text`, `Button`, `ScrollView` only. No styling, icons, animation or UI libraries.
- **Screens stay thin.** No logic here. Screens call hooks and functions from `trip/` (e.g. `useTripState`, `TripSession` methods) and `api/` (e.g. `useApiQuery`, `ApiClient` methods) and render the result as plain text or JSON.
- Logic modules never import from `ui/` (enforced by ESLint).
- Each workstream edits only its own debug screen: `dev/Ws1Debug.tsx` … `dev/Ws4Debug.tsx`.

## How it fits together
- `App.tsx` passes the module instances from `src/wiring.ts` to `Root`.
- `Root.tsx` does state-based navigation (`navigation.ts`). The UI phase replaces it with Expo Router (see `apps/mobile/AGENTS.md`).
- Screens: Start Drive → Driving → Trip Result; Past Trips; Dev Menu → WS1–WS4 debug screens.

## For the UI phase
Master doc §12 lists the target screens (start, driving lock screen, debrief, map + replay with `react-native-maps`, progress, settings). Keep the same rule: screens consume `trip/` and `api/`, never detection/road/voice internals.
