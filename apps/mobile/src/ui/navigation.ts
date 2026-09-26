/**
 * Placeholder state-based navigation (no library until the UI phase).
 * The UI phase replaces this with Expo Router (see apps/mobile/AGENTS.md).
 */
import type { AppModules } from '../wiring';

export type Route =
  | { name: 'start' }
  | { name: 'driving' }
  /** tripId null = the trip that just ended (from TripSession state). */
  | { name: 'result'; tripId: string | null }
  | { name: 'list' }
  | { name: 'dev' }
  | { name: 'ws1' }
  | { name: 'ws2' }
  | { name: 'ws3' }
  | { name: 'ws4' }
  | { name: 'recorder' };

/** Props every screen receives. */
export interface ScreenProps {
  modules: AppModules;
  navigate: (route: Route) => void;
}
