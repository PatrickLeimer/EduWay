/**
 * Turns the qualifying trips from GET /progress into points for the score
 * trend chart (components/ScoreTrendChart.tsx). Pure, tested in trend.test.ts.
 *
 * Display only: it filters, buckets and averages scores the server already
 * sent. No scoring, no thresholds and nothing that changes a number's meaning.
 */
import type { QualifyingTrip } from '@edudriver/shared';

/** Which tab the chart is showing. */
export type TrendView = 'weekly' | 'monthly' | 'all-time';

/** How All-Time plots its trips, once the history is long enough to crowd. */
export type TrendTier = 'raw' | 'weekly-buckets' | 'monthly-buckets';

/** Histories shorter than this many calendar months plot every trip. */
const RAW_TIER_MAX_MONTHS = 2;
/** From there up to this many months, plot one point per week. */
const WEEKLY_TIER_MAX_MONTHS = 24;
/** How far back the Weekly and Monthly tabs look. */
const WEEKLY_WINDOW_DAYS = 7;
const MONTHLY_WINDOW_DAYS = 30;

const MS_PER_DAY = 86_400_000;
const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** getMonth() is always 0 to 11, so the lookup always hits. */
function monthAbbr(d: Date): string {
  return MONTH_ABBR[d.getMonth()] ?? '';
}

export interface TrendPoint {
  /** X-axis label: "Trip 3", "Wk of Sep 15" or "Sep". */
  label: string;
  /** Whole score 0 to 100; the bucket average for bucketed points. */
  value: number;
  /** Trips behind this point (always 1 when not bucketed). */
  tripCount: number;
  /** Ready-made callout text for a tap. */
  tooltip: string;
}

/** The highest point in the view, for the personal-best marker. */
export interface TrendBest {
  index: number;
  value: number;
}

export interface Trend {
  points: TrendPoint[];
  tier: TrendTier;
  /** null when the view has no points. */
  best: TrendBest | null;
}

/** Whole calendar months from `from` to `to`, so "2 months" ignores month length. */
function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return to.getDate() < from.getDate() ? months - 1 : months;
}

/**
 * How All-Time should plot a history: raw under two months, one point per week
 * from two months up to two years, one per month at two years and beyond. The
 * two-month boundary itself buckets by week.
 */
export function allTimeTier(trips: QualifyingTrip[], now: Date): TrendTier {
  if (trips.length === 0) return 'raw';
  const earliest = new Date(Math.min(...trips.map((t) => Date.parse(t.completedAt))));
  const months = monthsBetween(earliest, now);
  if (months < RAW_TIER_MAX_MONTHS) return 'raw';
  if (months < WEEKLY_TIER_MAX_MONTHS) return 'weekly-buckets';
  return 'monthly-buckets';
}

function withinDays(trips: QualifyingTrip[], now: Date, days: number): QualifyingTrip[] {
  const from = now.getTime() - days * MS_PER_DAY;
  return trips.filter((t) => Date.parse(t.completedAt) >= from);
}

/** Monday of the week containing `d`, at local midnight. */
function weekStart(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

interface Bucket {
  start: Date;
  scores: number[];
}

/** Groups trips into buckets in time order. Buckets with no trips are skipped. */
function bucketize(trips: QualifyingTrip[], startOf: (d: Date) => Date): Bucket[] {
  const byStart = new Map<number, Bucket>();
  for (const trip of trips) {
    const start = startOf(new Date(trip.completedAt));
    const key = start.getTime();
    const bucket = byStart.get(key);
    if (bucket) bucket.scores.push(trip.score);
    else byStart.set(key, { start, scores: [trip.score] });
  }
  return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

function rawPoints(trips: QualifyingTrip[]): TrendPoint[] {
  return trips.map((trip, i) => {
    const value = Math.round(trip.score);
    const label = `Trip ${i + 1}`;
    return { label, value, tripCount: 1, tooltip: `${label}: ${value}` };
  });
}

function bucketPoints(trips: QualifyingTrip[], tier: TrendTier): TrendPoint[] {
  const weekly = tier === 'weekly-buckets';
  const buckets = bucketize(trips, weekly ? weekStart : monthStart);
  // Months only need a year once the range spans more than one.
  const spansYears = new Set(buckets.map((b) => b.start.getFullYear())).size > 1;

  return buckets.map((b) => {
    const value = Math.round(b.scores.reduce((sum, s) => sum + s, 0) / b.scores.length);
    const tripCount = b.scores.length;
    const noun = tripCount === 1 ? 'trip' : 'trips';
    const month = monthAbbr(b.start);

    if (weekly) {
      const day = `${month} ${b.start.getDate()}`;
      return {
        label: `Wk of ${day}`,
        value,
        tripCount,
        tooltip: `Week of ${day}: ${value} avg, ${tripCount} ${noun}`,
      };
    }
    const label = spansYears ? `${month} ${b.start.getFullYear()}` : month;
    return { label, value, tripCount, tooltip: `${label}: ${value} avg, ${tripCount} ${noun}` };
  });
}

/** Highest point in the series; the earliest one wins a tie. */
function bestOf(points: TrendPoint[]): TrendBest | null {
  let best: TrendBest | null = null;
  for (const [index, point] of points.entries()) {
    if (best === null || point.value > best.value) best = { index, value: point.value };
  }
  return best;
}

/**
 * Points for one tab. Weekly and Monthly plot every trip in the last 7 or 30
 * days; All-Time plots everything, bucketed once the history gets long.
 */
export function buildTrend(trips: QualifyingTrip[], view: TrendView, now: Date): Trend {
  const sorted = [...trips].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));

  if (view === 'all-time') {
    const tier = allTimeTier(sorted, now);
    const points = tier === 'raw' ? rawPoints(sorted) : bucketPoints(sorted, tier);
    return { points, tier, best: bestOf(points) };
  }

  const days = view === 'weekly' ? WEEKLY_WINDOW_DAYS : MONTHLY_WINDOW_DAYS;
  const points = rawPoints(withinDays(sorted, now, days));
  return { points, tier: 'raw', best: bestOf(points) };
}
