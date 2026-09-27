/**
 * The post-trip flow (§12 screen 3): Trip concluded → Replay → Infractions →
 * Driving growth → Coaching chat → done. Pure, tested in flow.test.ts.
 *
 * `origin` says where the flow started: 'trip' for the drive that just ended
 * (finishes on Home), 'history' for a past drive (finishes on Past drives).
 * Either way the flow opens on Trip concluded, so the score ring comes first.
 */
import type { FlowOrigin, Route } from '../navigation';

export const FLOW_STEPS = ['replay', 'infractions', 'growth', 'coach'] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

export const FLOW_TITLES: Record<FlowStep, string> = {
  replay: 'Replay',
  infractions: 'Infractions',
  growth: 'Driving growth',
  coach: 'Your coach',
};

/** Where Next goes; after the last step, where the flow ends. */
export function nextRoute(step: FlowStep, tripId: string, origin: FlowOrigin): Route {
  const next = FLOW_STEPS[FLOW_STEPS.indexOf(step) + 1];
  if (next) return { name: next, tripId, origin };
  return origin === 'trip' ? { name: 'start' } : { name: 'list' };
}

/** Where Back goes: the previous step, or where the flow came from. */
export function prevRoute(step: FlowStep, tripId: string, origin: FlowOrigin): Route {
  const prev = FLOW_STEPS[FLOW_STEPS.indexOf(step) - 1];
  if (prev) return { name: prev, tripId, origin };
  // Both origins open on the Trip concluded summary; only a past drive needs the id.
  return origin === 'trip' ? { name: 'ended' } : { name: 'ended', tripId };
}

/** 1-based position for the step dots. */
export function stepNumber(step: FlowStep): number {
  return FLOW_STEPS.indexOf(step) + 1;
}
