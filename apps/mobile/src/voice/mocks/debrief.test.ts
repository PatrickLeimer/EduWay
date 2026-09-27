import { describe, expect, it } from 'vitest';

import { createMockDebriefPlayer, MOCK_DEBRIEF_S } from '.';

describe('createMockDebriefPlayer', () => {
  it('runs a clock like real playback, with pause, resume and stop', async () => {
    let t = 0;
    const p = createMockDebriefPlayer(() => t);
    expect(p.positionS()).toBe(0);
    expect(p.durationS()).toBeNull();

    await p.play('/audio/x.mp3');
    t = 5000;
    expect(p.positionS()).toBe(5);
    expect(p.isPlaying()).toBe(true);
    expect(p.durationS()).toBe(MOCK_DEBRIEF_S);

    p.pause();
    t = 20000;
    expect(p.positionS()).toBe(5);
    expect(p.isPlaying()).toBe(false);

    p.resume();
    t = 22000;
    expect(p.positionS()).toBe(7);

    t = 999_000;
    expect(p.positionS()).toBe(MOCK_DEBRIEF_S);
    expect(p.isPlaying()).toBe(false);

    p.stop();
    expect(p.positionS()).toBe(0);
  });
});
