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

/** Length the mock pretends the debrief is, so the coaching chat still reveals bubble by bubble. */
export const MOCK_DEBRIEF_S = 45;

/** No audio: a clock that runs like playback would, with pause/resume. */
export function createMockDebriefPlayer(now: () => number = Date.now): DebriefPlayer {
  let startedAt: number | null = null;
  let pausedAtS: number | null = null;
  const positionS = () => {
    if (pausedAtS !== null) return pausedAtS;
    if (startedAt === null) return 0;
    return Math.min(MOCK_DEBRIEF_S, (now() - startedAt) / 1000);
  };
  return {
    async play(url) {
      console.log(`[voice mock] debrief: ${url}`);
      startedAt = now();
      pausedAtS = null;
    },
    stop() {
      startedAt = null;
      pausedAtS = null;
    },
    pause() {
      if (startedAt !== null && pausedAtS === null) pausedAtS = positionS();
    },
    resume() {
      if (pausedAtS === null) return;
      startedAt = now() - pausedAtS * 1000;
      pausedAtS = null;
    },
    positionS,
    durationS: () => (startedAt === null ? null : MOCK_DEBRIEF_S),
    isPlaying: () => startedAt !== null && pausedAtS === null && positionS() < MOCK_DEBRIEF_S,
  };
}
