/**
 * Display formatting for screens. Pure (no React Native), tested in format.test.ts.
 * Presentation only: no scoring, detection or threshold logic lives here.
 */
import { MPS_TO_MPH, type EventType, type TripCounts } from '@edudriver/shared';

export const EVENT_LABEL: Record<EventType, string> = {
  hard_brake: 'Hard brake',
  hard_accel: 'Hard acceleration',
  rough_turn: 'Rough turn',
  swerve: 'Swerve',
  speeding: 'Speeding',
  rolling_stop: 'Rolling stop',
  phone_use: 'Phone use',
};

export const COUNT_LABEL: Record<keyof TripCounts, string> = {
  brake: 'Hard brakes',
  accel: 'Hard accelerations',
  turn: 'Rough turns',
  swerve: 'Swerves',
  speeding: 'Speeding',
  rollingStop: 'Rolling stops',
  phoneUse: 'Phone use',
};

/** m/s → whole mph for display, or "--" when unknown. */
export function speedMphText(speedMps: number | null | undefined): string {
  if (speedMps == null || !Number.isFinite(speedMps)) return '--';
  return String(Math.max(0, Math.round(speedMps * MPS_TO_MPH)));
}

/** Seconds → "0:42", "12:05", "1:02:09". */
export function clockText(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** Seconds → "24 min", "1 h 5 min", "<1 min". */
export function durationText(totalS: number): string {
  const min = Math.round(totalS / 60);
  if (min < 1) return '<1 min';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function secondsBetween(fromIso: string, toIso: string): number {
  return Math.max(0, (Date.parse(toIso) - Date.parse(fromIso)) / 1000);
}

export function milesText(mi: number): string {
  return `${mi.toFixed(1)} mi`;
}

export function totalEvents(counts: TripCounts): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

/** "Sat, Sep 26 · 3:41 PM" */
export function dateText(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}
