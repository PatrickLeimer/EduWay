import { coachOutputFixture } from '@eduway/fixtures';
import { describe, expect, it } from 'vitest';

import { chatMessages, chatProgress, chatSchedule, readingDurationS, TYPING_LEAD_S } from './chat';

describe('chatMessages', () => {
  it('uses the chat when there is one', () => {
    expect(chatMessages(coachOutputFixture)).toEqual(coachOutputFixture.chat);
  });

  it('splits the summary into sentences for older trips without a chat', () => {
    const { chat: _chat, ...old } = coachOutputFixture;
    expect(
      chatMessages({ ...old, debrief_script: 'Nice drive! Watch 8th Street. Keep it up.' }),
    ).toEqual(['Nice drive!', 'Watch 8th Street.', 'Keep it up.']);
  });
});

describe('chatSchedule', () => {
  const msgs = ['aaaa', 'bbbbbbbbb', 'cccc'];

  it('uses the server timings when they match the messages', () => {
    expect(chatSchedule(msgs, [0, 2.5, 6], 10)).toEqual([0, 2.5, 6]);
  });

  it('spreads by length over the audio when timings are missing or all zero', () => {
    // Lengths 5, 10, 5 of 20 → starts at 0, 25% and 75% of 20 s.
    expect(chatSchedule(msgs, undefined, 20)).toEqual([0, 5, 15]);
    expect(chatSchedule(msgs, [0, 0, 0], 20)).toEqual([0, 5, 15]);
  });

  it('falls back to a reading pace with no audio', () => {
    const s = chatSchedule(['one two three', 'four five six', 'seven'], undefined, null);
    expect(s[0]).toBe(0);
    expect(s[1]).toBeCloseTo(1.8); // 3 words at 3/s + 0.8 s gap
    expect(s[2]).toBeCloseTo(3.6);
  });
});

describe('chatProgress', () => {
  const schedule = [0, 4, 9];

  it('shows each bubble once its start time is reached', () => {
    expect(chatProgress(schedule, 0).visible).toBe(1);
    expect(chatProgress(schedule, 3.9).visible).toBe(1);
    expect(chatProgress(schedule, 4).visible).toBe(2);
    expect(chatProgress(schedule, 20).visible).toBe(3);
  });

  it('shows "typing" just before the next bubble, and not after the last', () => {
    expect(chatProgress(schedule, 4 - TYPING_LEAD_S + 0.01).typing).toBe(true);
    expect(chatProgress(schedule, 1).typing).toBe(false);
    expect(chatProgress(schedule, 20).typing).toBe(false);
  });
});

describe('readingDurationS', () => {
  it('ends after the last bubble has had time to be read', () => {
    const msgs = ['one two three', 'four five six'];
    expect(readingDurationS(msgs, chatSchedule(msgs, undefined, null))).toBeCloseTo(2.8);
    expect(readingDurationS([], [])).toBe(0);
  });
});
