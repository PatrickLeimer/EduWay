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

  it('caps focus areas, chat and summary length from COACH', () => {
    expect(prompt).toContain(`1 to ${COACH.maxFocusAreas}`);
    expect(prompt).toContain(`${COACH.chatMinMessages} to ${COACH.chatMaxMessages} messages`);
    expect(prompt).toContain(`under ${COACH.maxChatWords} words`);
    expect(prompt).toContain(`under ${COACH.maxDebriefWords} words`);
  });

  it('asks for a conversational, personable coach, not a report', () => {
    expect(prompt).toMatch(/Sound like a real person, not a report or a bot/);
    expect(prompt).toMatch(/Never read out lists, labels, or headings/);
    expect(prompt).toMatch(/No questions that expect an answer/);
    expect(prompt).toMatch(/Never say "logged", "detected", "recorded"/);
    expect(prompt).toMatch(/Always use contractions/);
    expect(prompt).toMatch(/Copy the voice, never its facts/);
  });

  it('compares with history and recurring spots', () => {
    expect(prompt).toMatch(/recurring spot/);
    expect(prompt).toMatch(/Call out improvement/);
  });

  it('keeps focus areas on the safety order and puts the pattern in the chat only', () => {
    expect(prompt).toMatch(/main_problem does not change this choice/);
    expect(prompt).toMatch(/Do not add, remove, or reorder a focus area/);
    expect(prompt).toMatch(/Leave the main problem out of it; that belongs in the chat only/);
  });

  it('tells the coach when to drill the main problem and when to stay quiet', () => {
    expect(prompt).toMatch(/If main_problem is null, do not mention a long-term pattern/);
    expect(prompt).toMatch(/If main_problem is null, say nothing about a pattern across drives/);
    expect(prompt).toMatch(/you must mention that pattern once in the chat/);
    expect(prompt).toMatch(/give one concrete way to fix it/);
    expect(prompt).toMatch(
      /Name the street only when today's event of that type is on that street/,
    );
    expect(prompt).toMatch(/did not show up on this drive/);
    expect(prompt).toMatch(
      /Never name a different pattern, a different count, or a street that is null/,
    );
    expect(prompt).toMatch(/the main problem already covers it/);
  });

  it('asks for an encouraging, specific, plain voice', () => {
    expect(prompt).toMatch(/Lead with something they genuinely did well/);
    expect(prompt).toMatch(/Be specific/);
    expect(prompt).toMatch(/plain, everyday language/);
  });
});
