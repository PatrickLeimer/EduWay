# streetview/ — WS3 Street View callout (server side)

**Owner:** WS3. Routes: `src/routes/streetview.ts`. Master doc §12 "Street View callout".

## What it does
On trip upload, picks at most one infraction to show in Street View, checks Google has outdoor imagery there (free metadata endpoint), and computes the camera heading from the trace about 3 s before the event. Serves the thumbnail (Static API, streamed through) and a panorama page (Maps JavaScript API) for the app's WebView.

## Must not
- Store Street View images anywhere (MongoDB, disk). Only our own data is saved on the trip: `{ eventId, heading, caption }` (`StoredStreetView`, db/).
- Send Google keys or Google URLs to the app. The callout's URLs point to `/streetview/...` on this backend.
- Show an error to the student. No event, no imagery, no key → the feature is simply absent (`streetView: null`, 404 on the image routes).
- Hard-code tunables. They live in `STREET_VIEW` (`packages/shared/src/thresholds.ts`).

## Files
| File | Status |
|---|---|
| `pick.ts` | Done: exclusions and ranking (harsh, recurring spot, type priority, peak), heading ~3 s before the event with fallbacks (pure, tested) |
| `select.ts` | Done: walks at most 3 candidates against the coverage check; builds the callout from stored data (tested) |
| `google.ts` | Done: metadata check, thumbnail fetch, panorama page (tested with a fake `fetch`) |

## Config
`GOOGLE_STREETVIEW_KEY` turns the feature on (Street View Static API only). `GOOGLE_MAPS_JS_KEY` enables the panorama (Maps JavaScript API only, restricted by HTTP referrer to this backend's domain). See `server/.env.example`.
