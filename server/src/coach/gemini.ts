/**
 * Gemini coaching call (WS4). STUB. Master doc §10.
 * Uses @google/genai with JSON mode: responseMimeType 'application/json' and a
 * response schema matching CoachOutputSchema (shared). Validate the reply with
 * CoachOutputSchema.parse before returning it.
 */
import type { CoachOutput, TripSummary } from '@edudriver/shared';

export interface GeminiOptions {
  apiKey: string;
  model: string;
}

export async function generateCoaching(
  _summary: TripSummary,
  _opts: GeminiOptions,
): Promise<CoachOutput> {
  // TODO(WS4, §10): new GoogleGenAI({ apiKey }).models.generateContent({ model, contents:
  //   JSON.stringify(summary), config: { systemInstruction: buildSystemPrompt(),
  //   responseMimeType: 'application/json', responseSchema: ... } }) → CoachOutputSchema.parse.
  //   Check the current @google/genai docs for exact option names before writing this.
  throw new Error('TODO(WS4): generateCoaching not implemented');
}
