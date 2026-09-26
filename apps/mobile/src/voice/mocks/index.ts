/**
 * Voice mocks (WS4). No audio: they log what would be spoken and keep a
 * history the debug screens can show. The alert mock applies the real
 * cooldown rule so `alerted` flags on events look like production.
 */
import type { AlertPlayer, DebriefPlayer } from '../../contracts';
import { clipIdFor } from '../clips';
import { createAlertCooldown } from '../cooldown';

export interface MockAlertPlayer extends AlertPlayer {
  /** Clip ids "played", oldest first. */
  readonly history: { clipId: string; at: number }[];
}

export function createMockAlertPlayer(now: () => number = Date.now): MockAlertPlayer {
  const cooldown = createAlertCooldown();
  const history: { clipId: string; at: number }[] = [];
  return {
    history,
    async preload() {},
    play(type, ctx) {
      const t = now();
      if (!cooldown.tryAcquire(type, t)) return false;
      const clipId = clipIdFor(type, ctx?.limitMph);
      history.push({ clipId, at: t });
      console.log(`[voice mock] alert: ${clipId}`);
      return true;
    },
    reset() {
      cooldown.reset();
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
