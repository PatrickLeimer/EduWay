/**
 * Gemini coaching call (WS4). Master doc §10.
 * JSON mode: responseMimeType 'application/json' plus a JSON schema derived from
 * CoachOutputSchema (shared), and the reply is validated against it again.
 *
 * The SDK is imported lazily, like elevenlabs.ts: loading it under Vitest is
 * slow and every server test imports this file through service.ts.
 */
import { COACH, CoachOutputSchema, type CoachOutput, type TripSummary } from '@eduway/shared';
import { z } from 'zod';

import { buildSystemPrompt } from './prompt';

export interface GeminiOptions {
  apiKey: string;
  model: string;
}

/**
 * What Gemini must return: the shared schema with `chat` required and the
 * server-set audio timings left out. Built from CoachOutputSchema so the two
 * cannot drift.
 */
const GeminiReplySchema = CoachOutputSchema.omit({ chat_audio_starts_s: true }).extend({
  chat: z.array(z.string().min(1)).min(1),
  street_view_caption: z.string().nullable(),
});
export const COACH_RESPONSE_JSON_SCHEMA = z.toJSONSchema(GeminiReplySchema);

/**
 * Tried in order after GEMINI_MODEL when it fails. The free tier often answers
 * 503 "high demand" for one model while others still work, and each model has
 * its own daily quota (only 20 requests for gemini-3.8-flash). Same generation
 * as the main model, checked for quality on the fixture summary. Not used:
 * "-latest" aliases (they change model without notice, and gemini-flash-latest
 * shares 3.8's quota) and flash-lite models (fast, but they invent facts).
 */
export const GEMINI_FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
] as const;

/**
 * The student is waiting on the Trip concluded screen, so keep the worst case
 * bounded. One call per model, no SDK retries: a 429 means that model's quota
 * is used up (retrying only waits), and a busy 503 can take ~10 s to come back,
 * so moving on to the next model is faster than retrying the same one. If every
 * model fails, one more pass after a short pause, skipping models out of quota:
 * "high demand" spikes usually pass within seconds.
 */
export const GEMINI_HTTP = {
  /** Per model. */
  timeoutMs: 25_000,
  /** Pause before the second pass over the models. */
  secondPassDelayMs: 3_000,
} as const;

export async function generateCoaching(
  summary: TripSummary,
  opts: GeminiOptions,
): Promise<CoachOutput> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey: opts.apiKey,
    httpOptions: { timeout: GEMINI_HTTP.timeoutMs },
  });
  const allModels = [...new Set([opts.model, ...GEMINI_FALLBACK_MODELS])];
  const outOfQuota = new Set<string>();
  let lastError: unknown;

  for (const pass of [1, 2]) {
    const models = allModels.filter((m) => !outOfQuota.has(m));
    if (models.length === 0) break;
    if (pass === 2) {
      console.warn(
        `[coach] every model failed; trying again in ${GEMINI_HTTP.secondPassDelayMs} ms`,
      );
      await new Promise((r) => setTimeout(r, GEMINI_HTTP.secondPassDelayMs));
    }
    for (const model of models) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: JSON.stringify(summary),
          config: {
            systemInstruction: buildSystemPrompt(),
            responseMimeType: 'application/json',
            responseJsonSchema: COACH_RESPONSE_JSON_SCHEMA,
          },
        });
        const coach = parseCoachReply(res.text);
        // No Street View event → no caption, whatever the model wrote (§12).
        return summary.street_view_event ? coach : { ...coach, street_view_caption: null };
      } catch (e) {
        lastError = e;
        if (statusOf(e) === 429) outOfQuota.add(model);
        console.warn(`[coach] ${model} failed (pass ${pass}):`, errorSummary(e));
      }
    }
  }
  throw lastError;
}

function statusOf(e: unknown): number | null {
  return e && typeof e === 'object' && 'status' in e && typeof e.status === 'number'
    ? e.status
    : null;
}

function errorSummary(e: unknown): string {
  if (e && typeof e === 'object' && 'status' in e) return `HTTP ${String(e.status)}`;
  return e instanceof Error ? e.message.slice(0, 200) : String(e);
}

/** Validates Gemini's JSON text. Throws on empty, non-JSON, or off-schema replies. */
export function parseCoachReply(text: string | undefined): CoachOutput {
  if (!text) throw new Error('Gemini returned no text');
  const coach = GeminiReplySchema.parse(JSON.parse(text));
  // The prompt sets these limits (§10); enforce them rather than trust them.
  return {
    ...coach,
    focus_areas: coach.focus_areas.slice(0, COACH.maxFocusAreas),
    chat: coach.chat.slice(0, COACH.chatMaxMessages),
  };
}
