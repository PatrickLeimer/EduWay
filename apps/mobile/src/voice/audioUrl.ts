/**
 * The server returns debrief audio as a relative path ("/audio/<tripId>.mp3",
 * server/src/coach/elevenlabs.ts) so it works on any host. Pure.
 */
export function resolveAudioUrl(url: string, apiBaseUrl: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `${apiBaseUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}
