/**
 * Threshold facts handed to Gemini so it explains events the way our code
 * detected them (§10: "Provide event definitions and thresholds"). Derived
 * from @eduway/shared so the prompt never drifts from the detectors.
 */
import {
  COACH,
  HARD_ACCEL,
  HARD_BRAKE,
  ROLLING_STOP,
  ROUGH_TURN,
  SPEEDING,
  SWERVE,
} from '@eduway/shared';

export { COACH };

export const EVENT_THRESHOLDS_FOR_PROMPT = JSON.stringify({
  hard_brake: `deceleration ≥ ${HARD_BRAKE.coach.start} m/s² (harsh ≥ ${HARD_BRAKE.harsh.start})`,
  hard_accel: `acceleration ≥ ${HARD_ACCEL.coach.start} m/s² (harsh ≥ ${HARD_ACCEL.harsh.start})`,
  rough_turn: `lateral ≥ ${ROUGH_TURN.coach.start} m/s² (harsh ≥ ${ROUGH_TURN.harsh.start})`,
  swerve: `quick left-right of ±${SWERVE.coach.peakMps2} m/s² within ${SWERVE.windowS} s`,
  speeding: `≥ ${SPEEDING.coachOverMph} mph over for ${SPEEDING.minDurationS}+ s (harsh ≥ ${SPEEDING.harshOverMph})`,
  rolling_stop: `did not drop below ${ROLLING_STOP.maxStopSpeedMph} mph at a stop sign`,
  phone_use: 'touched the phone or left the app while moving',
});
