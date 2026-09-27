/**
 * Which way a screen change animates. Pure, tested in transitions.test.ts.
 * Deeper screens slide in from the right, shallower ones from the left,
 * driving mode rises in, and screens on the same level cross-fade.
 */
import type { Route } from '../navigation';

export type TransitionKind = 'forward' | 'back' | 'up' | 'fade';

const DEPTH: Record<Route['name'], number> = {
  start: 0,
  driving: 1,
  list: 1,
  progress: 1,
  settings: 1,
  ended: 2,
  dev: 2,
  result: 3,
  ws1: 3,
  ws2: 3,
  ws3: 3,
  ws4: 3,
  recorder: 3,
  replay: 4,
};

export function transitionFor(from: Route['name'], to: Route['name']): TransitionKind {
  if (to === 'driving') return 'up';
  // Leaving driving mode is a mode change too, not a "back".
  if (from === 'driving') return 'fade';
  const d = DEPTH[to] - DEPTH[from];
  if (d > 0) return 'forward';
  if (d < 0) return 'back';
  return 'fade';
}

/** Changes whenever the visible screen should replay its entrance. */
export function routeKey(route: Route): string {
  return 'tripId' in route ? `${route.name}:${route.tripId ?? 'current'}` : route.name;
}
