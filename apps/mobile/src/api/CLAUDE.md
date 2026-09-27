# api/ — WS3 Mobile API client

**Owner:** WS3 (with `server/src/**` except `coach/`). Debug screen: `src/ui/dev/Ws3Debug.tsx`.

## What it does
Typed client for every backend endpoint in master doc §13, plus the trace encoder (gzip + base64) for `POST /trips` and a small `useApiQuery` hook for screens.

## Must not
- Contain API keys or secrets. `EXPO_PUBLIC_API_URL` is the only config and it is public.
- Define request/response shapes locally. They come from `@edudriver/shared` (`api.ts`).
- Return unvalidated data. Every response is parsed with its shared schema.

## Contracts
- Implements: `ApiClient`, `ApiError` (`src/contracts/api.ts`).
- Consumes: request/response schemas and `API_ROUTES` from `@edudriver/shared`.
- Public API: `index.ts` only.

## Files
| File | Status |
|---|---|
| `HttpApiClient.ts` | Done: fetch transport + validation. TODO: timeouts, retry |
| `traceCodec.ts` | Done: tested against Node zlib |
| `useApiQuery.ts` | Done |
| `config.ts` | Done: `EXPO_PUBLIC_API_URL` |
| `mocks/` | Fixture-backed client that remembers created trips |

## Done means (master doc §14)
- [ ] Saturday afternoon: `wiring.ts` `api: true` works against the deployed server from a real phone.
- [ ] Request timeout and clear errors when offline (trip/ queues on failure).
- [ ] `Ws3Debug` exercises every endpoint against the real server.
