/**
 * Per-type live alert cooldown (master doc §7 "Live ElevenLabs alerts"). Pure.
 * Shared by the real AlertPlayer and the mock so both suppress the same alerts.
 *
 * Same type within ALERTS.cooldownS of the last one that played is suppressed;
 * suppressed attempts do not restart the window. ALERTS.cooldownExempt types
 * (phone use) always play.
 */
import { ALERTS, type LiveAlertType } from '@eduway/shared';

export interface AlertCooldown {
  /** True if `type` may play at `nowMs`, and records it as played. False while cooling down. */
  tryAcquire(type: LiveAlertType, nowMs: number): boolean;
  /** Forget every alert played so far (trip start). */
  reset(): void;
}

export function createAlertCooldown(): AlertCooldown {
  const lastPlayedMs = new Map<LiveAlertType, number>();
  return {
    tryAcquire(type, nowMs) {
      const last = lastPlayedMs.get(type);
      const exempt = ALERTS.cooldownExempt.includes(type);
      if (!exempt && last !== undefined && nowMs - last < ALERTS.cooldownS * 1000) return false;
      lastPlayedMs.set(type, nowMs);
      return true;
    },
    reset() {
      lastPlayedMs.clear();
    },
  };
}
