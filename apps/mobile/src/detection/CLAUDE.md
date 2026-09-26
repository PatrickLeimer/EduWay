# detection/ — WS1 Motion detection

**Owner:** WS1. Only WS1 edits this folder (plus `src/ui/dev/Ws1Debug.tsx`).

## What it does
Turns 50 Hz DeviceMotion samples and 1 Hz GPS fixes into discrete driving events: hard brake, hard acceleration, rough turn, swerve (master doc §5, §6, §7). Also detects phone use while moving (§7 "Phone use detection", §18 flag 2).

## Must not
- Store, upload or log motion samples beyond short in-memory ring buffers (§3, §9).
- Hard-code thresholds. Use `HARD_BRAKE`, `HARD_ACCEL`, `ROUGH_TURN`, `SWERVE`, `PIPELINE`, `PHONE_USE` from `@edudriver/shared`.
- Import React Native or Expo outside `expoMotionSource.ts` and `PhoneUseMonitor.ts`. Detector math stays pure so Vitest can run it.
- Add road context (street, limit) or play alerts. The trip session does that.
- Use ML models or detect turn signals (out of scope).

## Contracts
- Implements: `MotionSource`, `MotionDetector`, `PhoneUseMonitor` (`src/contracts/detection.ts`).
- Consumes: `MotionSample`, `GpsFix`, `DraftEvent` and thresholds from `@edudriver/shared`.
- Public API: `index.ts` only.

## Files
| File | Status |
|---|---|
| `vector.ts` | Done: vector helpers + EMA |
| `emitter.ts` | Done: listener registry |
| `MotionDetector.ts` | Partial: GPS tracking, EMA, junk rejection wired; §7 state machines still TODO |
| `expoMotionSource.ts` | Done: DeviceMotion adapter (permissions, 20 ms interval, subscription) |
| `deviceMotion.ts` | Done: pure reading → MotionSample (deg/s → rad/s, per-platform rotation axes) |
| `level1.ts` | Done: §6 Level 1 math (ĝ, yaw, horizontal magnitude, lateral/longitudinal) + GPS speed/dv/dt tracker |
| `signals.ts` | Done: §7 steps 2–3 EMA filter + junk check |
| `PhoneUseMonitor.ts` | STUB: AppState + touches |
| `mocks/` | Synthetic samples; fixture event replay |

## Done means (master doc §14)
- [ ] Friday night: `Ws1Debug` shows live readings; units verified (|accG| ≈ 9.8 still, rotation in rad/s).
- [ ] Saturday morning: brake, turn and swerve classified on test drives (coach + harsh tiers, merge within 3 s).
- [ ] Junk rejection pauses detection when the phone is picked up or dropped.
- [ ] Phone use episodes emitted with duration (lock on and lock off rules).
- [ ] Vitest cases for each detector using recorded/synthetic samples.
- [ ] Stretch: §6 Level 2 forward-axis learning.
