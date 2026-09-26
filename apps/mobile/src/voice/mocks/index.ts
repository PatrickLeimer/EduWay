/**
 * Voice mocks (WS4). No audio: they log what would be spoken and keep a
 * history the debug screens can show. The alert mock applies the real
 * cooldown rule so `alerted` flags on events look like production.
 */
import { ALERTS, type LiveAlertType } from '@edudriver/shared';

import type { AlertPlayer, DebriefPlayer } from '../../contracts';
import { clipIdFor } from '../clips';

export interface MockAlertPlayer extends AlertPlayer {
  /** Clip ids "played", oldest first. */
  readonly history: { clipId: string; at: number }[];
}

export function createMockAlertPlayer(now: () => number = Date.now): MockAlertPlayer {
  const lastPlayed = new Map<LiveAlertType, number>();
  const history: { clipId: string; at: number }[] = [];
  return {
    history,
    async preload() {},
    play(type, ctx) {
      const t = now();
      const last = lastPlayed.get(type);
      const exempt = ALERTS.cooldownExempt.includes(type);
      if (!exempt && last !== undefined && t - last < ALERTS.cooldownS * 1000) return false;
      lastPlayed.set(type, t);
      const clipId = clipIdFor(type, ctx?.limitMph);
      history.push({ clipId, at: t });
      console.log(`[voice mock] alert: ${clipId}`);
      return true;
    },
    reset() {
      lastPlayed.clear();
      history.length = 0;
    },
  };
}

export function createMockDebriefPlayer(): DebriefPlayer {
  return {
    async play(url) {
      console.log(`[voice mock] debrief: ${url}`);
    },
    stop() {},
  };
}
