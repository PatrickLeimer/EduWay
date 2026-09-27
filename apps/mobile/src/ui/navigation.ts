/**
 * State-based navigation. No navigation library: Expo Router (apps/mobile/AGENTS.md)
 * is a new dependency and needs team approval first (root CLAUDE.md).
 */
import type { AppModules } from '../wiring';

export type Route =
  | { name: 'start' }
  | { name: 'driving' }
  /** Trip just ended: upload status + "Get feedback" button. */
  | { name: 'ended' }
  /** Debrief. tripId null = the trip that just ended (from TripSession state). */
  | { name: 'result'; tripId: string | null }
  | { name: 'replay'; tripId: string }
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
