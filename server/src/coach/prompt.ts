/**
 * Gemini system prompt (master doc §10 "Prompt guidelines"). STUB: the
 * guidelines are listed so WS4 writes the prompt against them; iterate on
 * wording with real trip summaries.
 */
import { COACH, EVENT_THRESHOLDS_FOR_PROMPT } from './promptContext';

export function buildSystemPrompt(): string {
  // TODO(WS4, §10): write the real prompt. Must cover:
  //   - Role: patient driving instructor coaching a student for their road test.
  //   - Event definitions + thresholds (EVENT_THRESHOLDS_FOR_PROMPT) so it doesn't invent meanings.
  //   - Only reference events present in the data. Never make up incidents.
  //   - Say when a speeding limit was estimated (limit_confidence "inferred").
  //   - Phone use: serious, not lecturing.
  //   - Pick the 1 to COACH.maxFocusAreas most important focus areas.
  //   - Compare with history; call out improvement and recurring spots.
  //   - debrief_script under ~COACH.maxDebriefWords words. Tone: encouraging, specific, plain.
  return [
    'You are a patient driving instructor coaching a student driver preparing for their road test.',
    `Event definitions: ${EVENT_THRESHOLDS_FOR_PROMPT}`,
    `Keep debrief_script under ${COACH.maxDebriefWords} words.`,
  ].join('\n');
}
