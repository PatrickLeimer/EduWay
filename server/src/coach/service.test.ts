import { coachOutputFixture, tripSummaryFixture } from '@edudriver/fixtures';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCoachService } from './service';

const fakes = vi.hoisted(() => ({
  coach: null as unknown,
  voiceFails: false,
  voiced: [] as string[][],
}));
vi.mock('./gemini', () => ({ generateCoaching: async () => fakes.coach }));
vi.mock('./elevenlabs', () => ({
  synthesizeChat: async (messages: string[], tripId: string) => {
    fakes.voiced.push(messages);
    if (fakes.voiceFails) throw new Error('quota');
    return { url: `/audio/${tripId}.mp3`, chatStartsS: messages.map((_, i) => i * 3) };
  },
}));

const keys = {
  geminiApiKey: 'g',
  geminiModel: 'm',
  elevenLabsApiKey: 'e',
  elevenLabsVoiceId: 'v',
};

describe('createCoachService', () => {
  beforeEach(() => {
    fakes.coach = coachOutputFixture;
    fakes.voiceFails = false;
    fakes.voiced = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('voices the chat and attaches when each message starts', async () => {
    const res = await createCoachService(keys).coachTrip(tripSummaryFixture, 't1');
    expect(fakes.voiced).toEqual([coachOutputFixture.chat]);
    expect(res.audioUrl).toBe('/audio/t1.mp3');
    expect(res.coach?.chat_audio_starts_s).toEqual(coachOutputFixture.chat!.map((_, i) => i * 3));
  });

  it('voices the short summary when a reply has no chat', async () => {
    const { chat: _chat, ...noChat } = coachOutputFixture;
    fakes.coach = noChat;
    const res = await createCoachService(keys).coachTrip(tripSummaryFixture, 't1');
    expect(fakes.voiced).toEqual([[coachOutputFixture.debrief_script]]);
    expect(res.coach).not.toHaveProperty('chat_audio_starts_s');
  });

  it('keeps the coaching when the voice fails', async () => {
    fakes.voiceFails = true;
    const res = await createCoachService(keys).coachTrip(tripSummaryFixture, 't1');
    expect(res).toEqual({ coach: coachOutputFixture, audioUrl: null });
  });
});
