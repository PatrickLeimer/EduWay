# road/ — WS2 Road data

**Owner:** WS2 (with `trip/` and `src/wiring.ts`). Debug screen: `src/ui/dev/Ws2Debug.tsx`.

## What it does
Caches OpenStreetMap data from the Overpass API around the car and answers, per GPS fix: which street, what road class, what speed limit (posted or inferred), which stop signs are near (master doc §8). Detects speeding and rolling stops (§7).

## Must not
- Query Overpass per GPS update. Fetch around the car and refetch near the cache edge only.
- Use a road-class default (inferred) limit for a live alert. Only `posted` limits can produce harsh speeding.
- Use Google Roads, Places, Valhalla, TomTom, HERE, Mapbox or MapLibre (out of scope).
- Hard-code thresholds or default limits. Use `SPEEDING`, `ROLLING_STOP`, `ROAD` from `@edudriver/shared`.
- Show OSM-derived data anywhere without "© OpenStreetMap contributors".

## Contracts
- Implements: `RoadCache`, `RoadEventDetector` (`src/contracts/road.ts`).
- Consumes: `GpsFix`, `DraftEvent`, `LimitConfidence` from `@edudriver/shared`.
- Public API: `index.ts` only.

## Files
| File | Status |
|---|---|
| `geo.ts` | Done: haversine, heading difference |
| `overpass.ts` | STUB: query builder, `maxspeed` parser; response types done |
| `OverpassRoadCache.ts` | STUB: fetch, cache, way matching |
| `RoadEventDetector.ts` | STUB: speeding + rolling stop |
| `mocks/` | Fixture-backed cache (nearest segment) and event replay |

## Done means (master doc §14)
- [ ] Saturday afternoon: Overpass cache fetches around the car and refreshes near the edge; offline keeps the old cache (§18 flag 1).
- [ ] Way matching uses heading to break ties at intersections.
- [ ] `maxspeed` parsing ("40 mph", km/h numbers, "none") with tests.
- [ ] Speeding: coach at +5 mph for 5 s; harsh at +15 mph against posted limits only.
- [ ] Rolling stops: min speed within 15 m of a (direction-matched) stop sign > 2 mph, coach tier only.
- [ ] Demo route checked in advance for tagged limits (§8).
- [ ] Vitest tests against `fixtures/overpass.response.json`.
