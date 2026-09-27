import { coachOutputFixture, tripSummaryFixture } from '@edudriver/fixtures';
import { COACH } from '@edudriver/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COACH_RESPONSE_JSON_SCHEMA,
  GEMINI_FALLBACK_MODELS,
  GEMINI_HTTP,
  generateCoaching,
  parseCoachReply,
} from './gemini';
import { buildSystemPrompt } from './prompt';

// Fake SDK: records what we send, returns whatever the test sets as `reply`,
// answers 503 for any model in `busy` (and for the first `busyCalls` calls),
// and 429 for any model in `outOfQuota`.
const sdk = vi.hoisted(() => ({
  clientOpts: undefined as unknown,
  request: undefined as unknown,
  reply: undefined as string | undefined,
  busy: new Set<string>(),
  outOfQuota: new Set<string>(),
  busyCalls: 0,
  modelsTried: [] as string[],
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor(opts: unknown) {
      sdk.clientOpts = opts;
    }
    models = {
      generateContent: async (req: { model: string }) => {
        sdk.request = req;
        sdk.modelsTried.push(req.model);
        if (sdk.outOfQuota.has(req.model)) throw Object.assign(new Error('quota'), { status: 429 });
        if (sdk.busy.has(req.model) || sdk.modelsTried.length <= sdk.busyCalls) {
          throw Object.assign(new Error('high demand'), { status: 503 });
        }
        return { text: sdk.reply };
      },
    };
  },
}));

const fixtureJson = JSON.stringify(coachOutputFixture);

describe('generateCoaching', () => {
  beforeEach(() => {
    sdk.reply = fixtureJson;
    sdk.busy.clear();
    sdk.modelsTried = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
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

  it('bounds each call with a timeout and does not retry the same model', async () => {
    await generateCoaching(tripSummaryFixture, { apiKey: 'k', model: 'm' });
    expect(sdk.clientOpts).toEqual({
      apiKey: 'k',
      httpOptions: {
        timeout: GEMINI_HTTP.timeoutMs,
      },
    });
  });

  it('returns the validated coaching', async () => {
    const coach = await generateCoaching(tripSummaryFixture, { apiKey: 'k', model: 'm' });
    expect(coach).toStrictEqual({ ...coachOutputFixture, street_view_caption: null });
  });

  it('rejects an off-schema reply so the service can degrade to coach: null', async () => {
    sdk.reply = JSON.stringify({ strengths: 'not a list' });
    await expect(
      generateCoaching(tripSummaryFixture, { apiKey: 'k', model: 'm' }),
    ).rejects.toThrow();
  });
});

describe('generateCoaching Street View caption (§12)', () => {
  const event = { type: 'hard_brake' as const, street: 'SW 8th St', recurring_spot: true };

  beforeEach(() => {
    sdk.reply = fixtureJson;
    sdk.busy.clear();
  });

  it('keeps the caption when an event was picked', async () => {
    const coach = await generateCoaching(
      { ...tripSummaryFixture, street_view_event: event },
      { apiKey: 'k', model: 'm' },
    );
    expect(coach.street_view_caption).toBe(coachOutputFixture.street_view_caption);
  });

  it('drops a caption the model wrote without an event', async () => {
    for (const street_view_event of [null, undefined]) {
      const coach = await generateCoaching(
        { ...tripSummaryFixture, street_view_event },
        { apiKey: 'k', model: 'm' },
      );
      expect(coach.street_view_caption).toBeNull();
    }
  });

  it('requires the caption field (null allowed) in the Gemini schema', () => {
    expect(COACH_RESPONSE_JSON_SCHEMA).toMatchObject({
      required: expect.arrayContaining(['street_view_caption']),
    });
  });
});

describe('generateCoaching fallback models', () => {
  beforeEach(() => {
    sdk.reply = fixtureJson;
    sdk.busy.clear();
    sdk.outOfQuota.clear();
    sdk.busyCalls = 0;
    sdk.modelsTried = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Runs generateCoaching, fast-forwarding the pause before the second pass. */
  async function run(model: string) {
    const result = generateCoaching(tripSummaryFixture, { apiKey: 'k', model });
    result.catch(() => {}); // Observed below; avoid an unhandled rejection while timers advance.
    await vi.advanceTimersByTimeAsync(GEMINI_HTTP.secondPassDelayMs);
    return result;
  }

  it('uses only the main model when it answers', async () => {
    await generateCoaching(tripSummaryFixture, { apiKey: 'k', model: 'main' });
    expect(sdk.modelsTried).toEqual(['main']);
  });

  it('falls back to the next model when the main one is busy', async () => {
    sdk.busy.add('main');
    const coach = await generateCoaching(tripSummaryFixture, { apiKey: 'k', model: 'main' });
    expect(sdk.modelsTried).toEqual(['main', GEMINI_FALLBACK_MODELS[0]]);
    expect(coach.chat).toEqual(coachOutputFixture.chat);
  });

  it('tries every model in order, pauses, tries them again, then throws the last error', async () => {
    for (const m of ['main', ...GEMINI_FALLBACK_MODELS]) sdk.busy.add(m);
    await expect(run('main')).rejects.toMatchObject({ status: 503 });
    const pass = ['main', ...GEMINI_FALLBACK_MODELS];
    expect(sdk.modelsTried).toEqual([...pass, ...pass]);
  });

  it('succeeds on the second pass when a busy spike passes', async () => {
    sdk.busyCalls = 1 + GEMINI_FALLBACK_MODELS.length; // the whole first pass fails
    const coach = await run('main');
    expect(sdk.modelsTried).toHaveLength(2 + GEMINI_FALLBACK_MODELS.length);
    expect(sdk.modelsTried.at(-1)).toBe('main');
    expect(coach.chat).toEqual(coachOutputFixture.chat);
  });

  it('skips models that are out of quota on the second pass', async () => {
    sdk.outOfQuota.add('main');
    for (const m of GEMINI_FALLBACK_MODELS) sdk.busy.add(m);
    await expect(run('main')).rejects.toThrow();
    expect(sdk.modelsTried).toEqual(['main', ...GEMINI_FALLBACK_MODELS, ...GEMINI_FALLBACK_MODELS]);
  });

  it('gives up without a pause when every model is out of quota', async () => {
    for (const m of ['main', ...GEMINI_FALLBACK_MODELS]) sdk.outOfQuota.add(m);
    await expect(run('main')).rejects.toMatchObject({ status: 429 });
    expect(sdk.modelsTried).toEqual(['main', ...GEMINI_FALLBACK_MODELS]);
  });

  it('does not try the same model twice in a pass when the main model is also a fallback', async () => {
    const main = GEMINI_FALLBACK_MODELS[0];
    for (const m of GEMINI_FALLBACK_MODELS) sdk.busy.add(m);
    await expect(run(main)).rejects.toThrow();
    expect(sdk.modelsTried).toEqual([...GEMINI_FALLBACK_MODELS, ...GEMINI_FALLBACK_MODELS]);
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

  it('rejects a reply without a chat', () => {
    const { chat: _chat, ...noChat } = coachOutputFixture;
    expect(() => parseCoachReply(JSON.stringify(noChat))).toThrow();
  });

  it(`keeps at most ${COACH.chatMaxMessages} chat messages`, () => {
    const chat = Array.from({ length: COACH.chatMaxMessages + 3 }, (_, i) => `message ${i}`);
    const reply = { ...coachOutputFixture, chat };
    expect(parseCoachReply(JSON.stringify(reply)).chat).toHaveLength(COACH.chatMaxMessages);
  });

  it('never asks Gemini for the audio timings', () => {
    expect(JSON.stringify(COACH_RESPONSE_JSON_SCHEMA)).not.toContain('chat_audio_starts_s');
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
      required: expect.arrayContaining(['strengths', 'focus_areas', 'debrief_script', 'chat']),
    });
  });
});
