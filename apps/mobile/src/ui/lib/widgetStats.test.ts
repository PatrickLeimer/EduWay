import type { GetProgressResponse } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { EMPTY_WIDGET_STATS, parseWidgetStats, widgetStats } from './widgetStats';

function progress(clean: number, scores: (number | null)[]) {
  return {
    scores: scores.map((score, i) => ({
      tripId: `t${i}`,
      startedAt: '2026-09-29T15:00:00.000Z',
      score,
    })),
    userProgress: {
      streaks: {
        clean: { current: clean, best: clean },
        hot: { current: 0, best: 0 },
        phoneFree: { current: 0, best: 0 },
      },
    },
  } as unknown as Pick<GetProgressResponse, 'scores' | 'userProgress'>;
}

describe('widgetStats', () => {
  it('shows the clean streak and the latest scored drive', () => {
    expect(widgetStats(progress(3, [70, 86.4, null]))).toEqual({
      streak: 3,
      streakLabel: 'clean drives in a row',
      lastLine: 'Last score 86',
    });
  });

  it('uses the singular for one drive', () => {
    expect(widgetStats(progress(1, [90])).streakLabel).toBe('clean drive in a row');
  });

  it('nudges a first drive when nothing is scored yet', () => {
    expect(widgetStats(progress(0, [null]))).toEqual(EMPTY_WIDGET_STATS);
    expect(widgetStats(progress(0, []))).toEqual(EMPTY_WIDGET_STATS);
  });
});

describe('parseWidgetStats', () => {
  it('round-trips saved stats and rejects anything else', () => {
    const s = widgetStats(progress(2, [80]));
    expect(parseWidgetStats(JSON.stringify(s))).toEqual(s);
    expect(parseWidgetStats(null)).toBeNull();
    expect(parseWidgetStats('not json')).toBeNull();
    expect(parseWidgetStats('{"streak":"2"}')).toBeNull();
  });
});
