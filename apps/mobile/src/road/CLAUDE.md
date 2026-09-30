# road/ — WS2 Road data

**Owner:** WS2 (with `trip/` and `src/wiring.ts`). Debug screen: `src/ui/dev/Ws2Debug.tsx`.

## What it does
This is the road-data layer beside Google Maps. Maps (`react-native-maps`) draw the route; this module answers, per GPS fix, which street, what road class, what speed limit (posted or inferred), and which stop signs are near, from an OpenStreetMap Overpass cache (master doc §8). Those fields are what the map labels. Detects speeding and rolling stops (§7).

## Must not
- Query Overpass per GPS update. Fetch around the car and refetch near the cache edge only.
- Use a road-class default (inferred) limit for a live alert. Only `posted` limits can produce harsh speeding.
- Use Google Roads, Places, Valhalla, TomTom, HERE, Mapbox or MapLibre (out of scope).
- Hard-code thresholds or default limits. Use `SPEEDING`, `ROLLING_STOP`, `ROAD` from `@eduway/shared`.
- Show OSM-derived data anywhere without "© OpenStreetMap contributors".

## Contracts
- Implements: `RoadCache`, `RoadEventDetector` (`src/contracts/road.ts`).
- Consumes: `GpsFix`, `DraftEvent`, `LimitConfidence` from `@eduway/shared`.
- Public API: `index.ts` only.

## Files
| File | Status |
|---|---|
| `geo.ts` | Done: haversine, heading difference, segment distance and bearing |
| `overpass.ts` | Done: query builder, `maxspeed` parser, response split |
| `match.ts` | Done: way match with heading tie-break, cache-edge check, stop direction |
| `OverpassRoadCache.ts` | Done: fetch, refresh near the edge, keep the old cache on failure |
| `RoadEventDetector.ts` | Done: speeding + rolling stop |
| `mocks/` | Fixture-backed cache (nearest segment) and event replay |

## Done means (master doc §14)
- [x] Saturday afternoon: Overpass cache fetches around the car and refreshes near the edge; offline keeps the old cache (§18 flag 1).
- [x] Way matching uses heading to break ties at intersections.
- [x] `maxspeed` parsing ("40 mph", km/h numbers, "none") with tests.
- [x] Speeding: coach at +5 mph for 5 s; harsh at +15 mph against posted limits only.
- [x] Rolling stops: min speed within 15 m of a (direction-matched) stop sign > 2 mph, coach tier only.
- [ ] Demo route checked in advance for tagged limits (§8).
- [x] Vitest tests against `fixtures/overpass.response.json`.
