import { coachOutputFixture, tripSummaryFixture } from '@edudriver/fixtures';
import { COACH } from '@edudriver/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COACH_RESPONSE_JSON_SCHEMA,
  GEMINI_HTTP,
  generateCoaching,
  parseCoachReply,
} from './gemini';
import { buildSystemPrompt } from './prompt';

// Fake SDK: records what we send, returns whatever the test sets as `reply`.
const sdk = vi.hoisted(() => ({
  clientOpts: undefined as unknown,
  request: undefined as unknown,
  reply: undefined as string | undefined,
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor(opts: unknown) {
      sdk.clientOpts = opts;
    }
    models = {
      generateContent: async (req: unknown) => {
        sdk.request = req;
        return { text: sdk.reply };
      },
    };
  },
}));

const fixtureJson = JSON.stringify(coachOutputFixture);

describe('generateCoaching', () => {
  beforeEach(() => {
    sdk.reply = fixtureJson;
  });

  it('sends the summary with the system prompt in JSON mode', async () => {
    await generateCoaching(tripSummaryFixture, { apiKey: 'k', model: 'm' });
    expect(sdk.request).toEqual({
      model: 'm',
      contents: JSON.stringify(tripSummaryFixture),
      config: {
        systemInstruction: buildSystemPrompt(),
        responseMimeType: 'application/json',
        responseJsonSchema: COACH_RESPONSE_JSON_SCHEMA,
      },
    });
  });

  it('bounds each attempt and retries busy replies', async () => {
    await generateCoaching(tripSummaryFixture, { apiKey: 'k', model: 'm' });
    expect(sdk.clientOpts).toEqual({
      apiKey: 'k',
      httpOptions: {
        timeout: GEMINI_HTTP.timeoutMs,
        retryOptions: {
          attempts: GEMINI_HTTP.attempts,
          initialDelay: GEMINI_HTTP.initialDelayS,
          maxDelay: GEMINI_HTTP.maxDelayS,
        },
      },
    });
  });

  it('returns the validated coaching', async () => {
    const coach = await generateCoaching(tripSummaryFixture, { apiKey: 'k', model: 'm' });
    expect(coach).toStrictEqual(coachOutputFixture);
  });

  it('rejects an off-schema reply so the service can degrade to coach: null', async () => {
    sdk.reply = JSON.stringify({ strengths: 'not a list' });
    await expect(
      generateCoaching(tripSummaryFixture, { apiKey: 'k', model: 'm' }),
    ).rejects.toThrow();
  });
});

describe('parseCoachReply', () => {
  it('parses a valid reply', () => {
    expect(parseCoachReply(fixtureJson)).toStrictEqual(coachOutputFixture);
  });

  it('throws on empty or non-JSON text', () => {
    expect(() => parseCoachReply(undefined)).toThrow('no text');
    expect(() => parseCoachReply('')).toThrow('no text');
    expect(() => parseCoachReply('Sure! Here is your coaching')).toThrow();
  });

  it(`keeps at most ${COACH.maxFocusAreas} focus areas`, () => {
    const extra = { skill: 's', why: 'w', tip: 't' };
    const reply = { ...coachOutputFixture, focus_areas: [extra, extra, extra, extra] };
    expect(parseCoachReply(JSON.stringify(reply)).focus_areas).toHaveLength(COACH.maxFocusAreas);
  });
});

describe('COACH_RESPONSE_JSON_SCHEMA', () => {
  it('requires the three coaching fields', () => {
    expect(COACH_RESPONSE_JSON_SCHEMA).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['strengths', 'focus_areas', 'debrief_script']),
    });
  });
});
