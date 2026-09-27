/**
 * State-based navigation. No navigation library: Expo Router (apps/mobile/AGENTS.md)
 * is a new dependency and needs team approval first (root CLAUDE.md).
 */
import type { AppModules } from '../wiring';

/** Where the post-trip flow started: the drive that just ended, or Past drives (lib/flow.ts). */
export type FlowOrigin = 'trip' | 'history';

export type Route =
  | { name: 'start' }
  | { name: 'driving' }
  /** Trip concluded: loading while it uploads and is coached, then the score and Next. */
  | { name: 'ended' }
  // Post-trip flow, one step at a time (lib/flow.ts, §12 screen 3).
  | { name: 'replay'; tripId: string; origin: FlowOrigin }
  | { name: 'infractions'; tripId: string; origin: FlowOrigin }
  | { name: 'growth'; tripId: string; origin: FlowOrigin }
  | { name: 'coach'; tripId: string; origin: FlowOrigin }
  | { name: 'list' }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'dev' }
  | { name: 'ws1' }
  | { name: 'ws2' }
  | { name: 'ws3' }
  | { name: 'ws4' }
  | { name: 'recorder' };

/** User preferences (§12 screen 6). In memory only: persisting needs storage the team hasn't picked. */
export interface AppSettings {
  /** Default for the driving lock toggle on the start screen (§4, on by default [Proposed]). */
  lockByDefault: boolean;
  /** "Test drive": replay the fixture drive instead of real GPS/sensors (wiring.ts DEMO_FLAGS). */
  demoMode: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = { lockByDefault: true, demoMode: false };

/** Props every screen receives. */
export interface ScreenProps {
  modules: AppModules;
  navigate: (route: Route) => void;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}
