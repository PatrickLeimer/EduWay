// Guards the §10 prompt guidelines so a rewrite of the wording cannot silently drop one.
import { COACH, EVENT_TYPES } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { buildSystemPrompt } from './prompt';

const prompt = buildSystemPrompt();

describe('buildSystemPrompt (§10 guidelines)', () => {
  it('sets the instructor role', () => {
    expect(prompt).toMatch(/patient driving instructor/);
    expect(prompt).toMatch(/road test/);
  });

  it('defines every event type with its thresholds', () => {
    for (const type of EVENT_TYPES) expect(prompt).toContain(type);
  });

  it('forbids inventing events and doing the scoring', () => {
    expect(prompt).toMatch(/Never invent incidents/);
    expect(prompt).toMatch(/Never calculate, change, or second-guess/);
    expect(prompt).toMatch(/Never say one event caused or led to another/);
  });

  it('says to call inferred limits estimated', () => {
    expect(prompt).toMatch(/"inferred", say the limit was estimated/);
  });

  it('treats phone use seriously without lecturing', () => {
    expect(prompt).toMatch(/Phone use: treat it seriously but do not lecture/);
  });

  it('caps focus areas and debrief length from COACH', () => {
    expect(prompt).toContain(`1 to ${COACH.maxFocusAreas}`);
    expect(prompt).toContain(`Under ${COACH.maxDebriefWords} words`);
  });

  it('compares with history and recurring spots', () => {
    expect(prompt).toMatch(/recurring spot/);
    expect(prompt).toMatch(/Call out improvement/);
  });

  it('asks for an encouraging, specific, plain voice', () => {
    expect(prompt).toMatch(/Lead with something they genuinely did well/);
    expect(prompt).toMatch(/Be specific/);
    expect(prompt).toMatch(/plain, everyday language/);
  });
});
