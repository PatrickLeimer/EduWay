/**
 * The server returns its own links as paths ("/streetview/<tripId>/thumbnail"),
 * so they work on any host. Screens resolve them against the API base URL. Pure.
 */
export function absoluteUrl(path: string, apiBaseUrl: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  return `${apiBaseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
