# ui/ — app screens

The full UI decision record (style, every screen, components, doc rules, open
items, and how to rebuild it) is in **`docs/ui-prompt.md`**. Read it before
changing anything here.

## Layout
- `theme.ts`: design tokens (colors, spacing, type). Restyle here first.
- `navigation.ts` / `Root.tsx`: state-based navigation (no navigation library until the team approves one).
- `screens/`: product screens (Home, Driving, Drive complete, Feedback, Replay, Past drives, Progress, Settings, Dev menu).
- `components/`: shared UI pieces; `MapCanvas` is the only map.
- `lib/`: pure display helpers with Vitest tests (no React Native imports).
- `dev/`: WS1–WS4 debug screens. Each workstream edits only its own.
- `widget/`: home-screen "Drive" widget showing the clean-drive streak and last score (`lib/widgetStats.ts`). iPhone: `iosDriveWidget.tsx` (expo-widgets; gets theme colors as props). Android: `androidWidget.tsx` (react-native-android-widget; draws from stats saved by `widgetStatsStore.ts`). `useDriveWidgetSync.ts` refreshes it on open and after each drive. Both libraries throw in Expo Go, so they load only after `nativeWidgets.ts` checks. A tap opens `eduway://drive/start` (`trip/useStartDriveLink.ts`); in Expo Go that link is `exp://<host>/--/drive/start`.

## Rules (root CLAUDE.md)
- Screens get data from `trip/` and `api/` (plus the `DebriefPlayer` contract for debrief playback) and never from detection/road/voice internals.
- Logic modules never import from `ui/` (enforced by ESLint).
- Show `© OpenStreetMap contributors` wherever OSM street names or limits appear. The map is Google Maps via `react-native-maps`; no other map or road provider.
