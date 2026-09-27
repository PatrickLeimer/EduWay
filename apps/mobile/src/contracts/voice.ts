/**
 * WS4 Voice boundary (phone side). Master doc §7 "Live ElevenLabs alerts", §11.
 * PROTECTED CONTRACT (see root CLAUDE.md).
 *
 * Live alerts use pre-generated clips bundled in the app (zero latency, works
 * offline). Voice only, never visual.
 */
import type { LiveAlertType } from '@edudriver/shared';

export interface AlertContext {
  /** Speeding only: picks the "the limit here is N" clip closest to this. */
  limitMph?: number | null;
}

export interface AlertPlayer {
  /** Load bundled clips into memory. Call at trip start. */
  preload(): Promise<void>;
  /**
   * Play the alert for `type`, respecting the per-type cooldown
   * (ALERTS.cooldownS; phone_use exempt). Returns true if a clip was played,
   * false if suppressed by cooldown. The caller records the result as
   * `alerted` on the event.
   */
  play(type: LiveAlertType, ctx?: AlertContext): boolean;
  /** Clear cooldown state (trip start). */
  reset(): void;
}

/** Plays the ElevenLabs debrief returned by the server (§11). */
export interface DebriefPlayer {
  play(url: string): Promise<void>;
  stop(): void;
}
