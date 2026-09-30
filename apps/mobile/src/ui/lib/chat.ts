/**
 * Coaching chat timing (§10 "Output", §11). Pure, tested in chat.test.ts.
 * Decides which bubbles are visible at a point in the debrief audio, so each
 * bubble appears as the coach starts saying it.
 */
import type { CoachOutput } from '@eduway/shared';

/** A bubble shows its "typing…" dots this long before it appears. */
export const TYPING_LEAD_S = 1.2;
/** Reading pace when there is no audio (words per second), plus a pause between bubbles. */
const READ_WORDS_PER_S = 3;
const READ_GAP_S = 0.8;

/** The chat messages, or the short summary split into sentences for trips coached before chat existed. */
export function chatMessages(coach: CoachOutput): string[] {
  if (coach.chat?.length) return coach.chat;
  return (coach.debrief_script.match(/[^.!?]+[.!?]+/g) ?? [coach.debrief_script])
    .map((s) => s.trim())
    .filter(Boolean);
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * Seconds at which each message appears.
 * 1. Server timings from ElevenLabs when they match the messages.
 * 2. Otherwise spread by message length over the audio's duration.
 * 3. Otherwise (no audio) a comfortable reading pace, first bubble at once.
 */
export function chatSchedule(
  messages: string[],
  startsS: number[] | undefined,
  audioDurationS: number | null,
): number[] {
  if (startsS && startsS.length === messages.length && startsS.some((s) => s > 0)) {
    return startsS;
  }
  if (audioDurationS && audioDurationS > 0) {
    const lengths = messages.map((m) => m.length + 1);
    const total = lengths.reduce((a, b) => a + b, 0);
    let at = 0;
    return lengths.map((len) => {
      const start = (at / total) * audioDurationS;
      at += len;
      return Math.round(start * 100) / 100;
    });
  }
  let t = 0;
  return messages.map((m, i) => {
    const start = t;
    t += words(m) / READ_WORDS_PER_S + READ_GAP_S;
    return i === 0 ? 0 : Math.round(start * 100) / 100;
  });
}

/** How many bubbles are visible at `positionS`, and whether the next one is "typing". */
export function chatProgress(
  schedule: number[],
  positionS: number,
): { visible: number; typing: boolean } {
  const visible = schedule.filter((s) => s <= positionS).length;
  const next = schedule[visible];
  return { visible, typing: next !== undefined && next - positionS <= TYPING_LEAD_S };
}

/** When the no-audio reading clock is done (last bubble shown plus a beat). */
export function readingDurationS(messages: string[], schedule: number[]): number {
  const last = messages.length - 1;
  if (last < 0) return 0;
  return (schedule[last] ?? 0) + words(messages[last] ?? '') / READ_WORDS_PER_S;
}
