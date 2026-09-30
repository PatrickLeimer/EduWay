/**
 * Mock scoring (WS3): the fixture trip's counts, stats and score, whatever the
 * input (score null for passenger trips, like the real rule).
 */
import { tripFixture } from '@eduway/fixtures';

import type { ScoreTrip } from '../score';

export const mockScoreTrip: ScoreTrip = ({ passenger }) => ({
  score: passenger ? null : tripFixture.score,
  counts: tripFixture.counts,
  stats: tripFixture.stats,
});
