import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { joinChat, messageStartTimes, synthesizeChat } from './elevenlabs';

// Fake SDK: one second per character, so a message's start time equals its offset.
const sdk = vi.hoisted(() => ({ calls: [] as { voiceId: string; text: string }[] }));
vi.mock('@elevenlabs/elevenlabs-js', () => ({
  ElevenLabsClient: class {
    textToSpeech = {
      convertWithTimestamps: async (voiceId: string, req: { text: string }) => {
        sdk.calls.push({ voiceId, text: req.text });
        return {
          audioBase64: Buffer.from('fake-mp3').toString('base64'),
          alignment: {
            characters: [...req.text],
            characterStartTimesSeconds: [...req.text].map((_, i) => i),
            characterEndTimesSeconds: [...req.text].map((_, i) => i + 1),
          },
        };
      },
    };
  },
}));

describe('joinChat', () => {
  it('joins messages with one space and records where each starts', () => {
    expect(joinChat(['Hey there!', '  Nice drive. ', 'Bye.'])).toEqual({
      text: 'Hey there! Nice drive. Bye.',
      offsets: [0, 11, 23],
    });
  });
});

describe('messageStartTimes', () => {
  it('reads the start time of each message from the character timings', () => {
    const starts = [0, 0.1, 0.2, 0.3, 0.5, 0.9, 1.2, 1.4];
    expect(messageStartTimes([0, 4, 6], 8, { characterStartTimesSeconds: starts })).toEqual([
      0, 0.5, 1.2,
    ]);
  });

  it('scales offsets when the timings cover a different number of characters', () => {
    const starts = [0, 1, 2, 3, 4];
    // Offset 5 of 10 characters is halfway, so the middle timing (index 2).
    expect(messageStartTimes([0, 5], 10, { characterStartTimesSeconds: starts })).toEqual([0, 2]);
  });

  it('never goes backwards and returns zeros without timings', () => {
    const starts = [0, 2, 1, 3];
    expect(messageStartTimes([0, 1, 2], 4, { characterStartTimesSeconds: starts })).toEqual([
      0, 2, 2,
    ]);
    expect(messageStartTimes([0, 5], 10)).toEqual([0, 0]);
  });
});

describe('synthesizeChat', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
    sdk.calls = [];
  });

  it('voices the whole chat in one call, saves the mp3 and returns a relative URL', async () => {
    const audioDir = mkdtempSync(join(tmpdir(), 'debrief-'));
    dirs.push(audioDir);
    const res = await synthesizeChat(['Hi!', 'Nice drive.'], 'trip/1', {
      apiKey: 'k',
      voiceId: 'v',
      audioDir,
    });
    expect(sdk.calls).toEqual([{ voiceId: 'v', text: 'Hi! Nice drive.' }]);
    expect(res).toEqual({ url: '/audio/trip_1.mp3', chatStartsS: [0, 4] });
    expect(readFileSync(join(audioDir, 'trip_1.mp3'), 'utf8')).toBe('fake-mp3');
  });
});
