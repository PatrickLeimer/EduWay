/**
 * Real AlertPlayer and DebriefPlayer over expo-audio (WS4). STUB.
 * Master doc §7 "Live ElevenLabs alerts", §11.
 *
 * Keep the cooldown decision in a pure function (e.g. cooldown.ts) so it can
 * be unit tested; this file should only load and play audio.
 * Docs (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/audio/
 */
import type { LiveAlertType } from '@edudriver/shared';

import type { AlertContext, AlertPlayer, DebriefPlayer } from '../contracts';

export function createAlertPlayer(): AlertPlayer {
  return {
    async preload() {
      // TODO(WS4): create one expo-audio player per clip in assets/alerts/ (static require map).
      //   Set the audio mode so clips play over music and with the screen on (§4).
    },
    play(_type: LiveAlertType, _ctx?: AlertContext): boolean {
      // TODO(WS4, §7): cooldown per type (ALERTS.cooldownS, phone_use exempt), then play
      //   clipIdFor(type, ctx?.limitMph). Return whether a clip actually played.
      return false;
    },
    reset() {
      // TODO(WS4): clear cooldown timestamps.
    },
  };
}

export function createDebriefPlayer(): DebriefPlayer {
  return {
    async play(_url: string) {
      // TODO(WS4, §11): stream the ElevenLabs debrief mp3 from the server URL.
    },
    stop() {
      // TODO(WS4): stop and release the player.
    },
  };
}
