/**
 * Alert clip catalog (master doc §7 "Live ElevenLabs alerts"). Pure.
 *
 * The clip ids and texts must match scripts/alert-clips/clips.manifest.json,
 * which generates the mp3 files into apps/mobile/assets/alerts/<id>.mp3.
 * Once the files exist, WS4 adds a static `require()` map in AlertPlayer.ts
 * (Metro needs literal require paths, so it cannot be built from this list).
 */
import type { LiveAlertType } from '@eduway/shared';

/** Speed limits we pre-generate "Slow down, the limit here is N" clips for. */
export const SPEED_LIMIT_CLIPS_MPH = [25, 30, 35, 40, 45, 55, 65] as const;

/** Clip id for an alert. Speeding picks the closest pre-generated limit, or a generic clip. */
export function clipIdFor(type: LiveAlertType, limitMph?: number | null): string {
  if (type !== 'speeding') return type;
  if (limitMph == null) return 'speeding';
  const closest = SPEED_LIMIT_CLIPS_MPH.reduce((best, l) =>
    Math.abs(l - limitMph) < Math.abs(best - limitMph) ? l : best,
  );
  return closest === limitMph ? `speeding_${closest}` : 'speeding';
}
