import { ALERTS } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { createAlertCooldown } from './cooldown';

const COOLDOWN_MS = ALERTS.cooldownS * 1000;

describe('createAlertCooldown', () => {
  it('plays the first alert of a type', () => {
    expect(createAlertCooldown().tryAcquire('hard_brake', 0)).toBe(true);
  });

  it('suppresses the same type inside the cooldown and allows it once the cooldown has passed', () => {
    const c = createAlertCooldown();
    c.tryAcquire('hard_brake', 0);
    expect(c.tryAcquire('hard_brake', COOLDOWN_MS - 1)).toBe(false);
    expect(c.tryAcquire('hard_brake', COOLDOWN_MS)).toBe(true);
  });

  it('does not restart the window on a suppressed attempt', () => {
    const c = createAlertCooldown();
    c.tryAcquire('swerve', 0);
    expect(c.tryAcquire('swerve', COOLDOWN_MS / 2)).toBe(false);
    expect(c.tryAcquire('swerve', COOLDOWN_MS)).toBe(true);
  });

  it('keeps a separate cooldown per type', () => {
    const c = createAlertCooldown();
    c.tryAcquire('hard_brake', 0);
    expect(c.tryAcquire('rough_turn', 1)).toBe(true);
    expect(c.tryAcquire('speeding', 2)).toBe(true);
  });

  it('never suppresses phone use', () => {
    const c = createAlertCooldown();
    expect(c.tryAcquire('phone_use', 0)).toBe(true);
    expect(c.tryAcquire('phone_use', 1)).toBe(true);
    expect(c.tryAcquire('phone_use', 2)).toBe(true);
  });

  it('reset clears every cooldown', () => {
    const c = createAlertCooldown();
    c.tryAcquire('hard_brake', 0);
    c.reset();
    expect(c.tryAcquire('hard_brake', 1)).toBe(true);
  });
});
