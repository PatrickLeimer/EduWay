/**
 * API base URL. Set EXPO_PUBLIC_API_URL in apps/mobile/.env (not committed),
 * e.g. http://192.168.1.20:4000 when testing on a phone against a laptop server.
 * EXPO_PUBLIC_ vars are inlined at build time and are NOT secret; never put API
 * keys here (root CLAUDE.md "Secrets").
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
