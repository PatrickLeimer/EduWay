/**
 * Outbound links the driving UI offers (§4: emergency calls and navigation
 * always stay available). Pure, tested in links.test.ts.
 *
 * Directions open the Google Maps app through a public Maps URL (no API key,
 * no Directions API). EduWay does not do turn-by-turn itself.
 */

/** Emergency number dialed from driving mode. */
export const EMERGENCY_NUMBER = '911';

export function emergencyUrl(): string {
  return `tel:${EMERGENCY_NUMBER}`;
}

/** Google Maps driving directions; with no destination it just opens Maps. */
export function directionsUrl(destination?: string): string {
  const base = 'https://www.google.com/maps/dir/?api=1&travelmode=driving';
  const dest = destination?.trim();
  return dest ? `${base}&destination=${encodeURIComponent(dest)}` : base;
}
