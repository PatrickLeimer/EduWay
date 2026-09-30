/**
 * Real AlertPlayer and DebriefPlayer over expo-audio (WS4).
 * Master doc §7 "Live ElevenLabs alerts", §11.
 *
 * Only loads and plays audio. The cooldown rule lives in cooldown.ts (pure, tested)
 * and the clip choice in clips.ts.
 * Docs (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/audio/
 */
import type { LiveAlertType } from '@eduway/shared';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer as ExpoPlayer } from 'expo-audio';

import { API_BASE_URL } from '../api';
import type { AlertContext, AlertPlayer, DebriefPlayer } from '../contracts';
import { resolveAudioUrl } from './audioUrl';
import { clipIdFor } from './clips';
import { createAlertCooldown } from './cooldown';

/**
 * Bundled clips from scripts/alert-clips (npm run alert-clips). Metro needs literal
 * require paths, so this map is written out by hand; clips.test.ts checks it
 * matches the manifest.
 */
const CLIP_SOURCES: Record<string, number> = {
  hard_brake: require('../../assets/alerts/hard_brake.mp3'),
  rough_turn: require('../../assets/alerts/rough_turn.mp3'),
  swerve: require('../../assets/alerts/swerve.mp3'),
  phone_use: require('../../assets/alerts/phone_use.mp3'),
  speeding: require('../../assets/alerts/speeding.mp3'),
  speeding_25: require('../../assets/alerts/speeding_25.mp3'),
  speeding_30: require('../../assets/alerts/speeding_30.mp3'),
  speeding_35: require('../../assets/alerts/speeding_35.mp3'),
  speeding_40: require('../../assets/alerts/speeding_40.mp3'),
  speeding_45: require('../../assets/alerts/speeding_45.mp3'),
  speeding_55: require('../../assets/alerts/speeding_55.mp3'),
  speeding_65: require('../../assets/alerts/speeding_65.mp3'),
};

/**
 * Play over the student's music with the screen on (§4, §7), even on iOS silent mode.
 * mixWithOthers rather than duckOthers: on iOS ducking can hold music down for the
 * whole drive. Revisit on a phone test if alerts are hard to hear over music.
 */
async function setDrivingAudioMode(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
  });
}

export function createAlertPlayer(now: () => number = Date.now): AlertPlayer {
  const cooldown = createAlertCooldown();
  const players = new Map<string, ExpoPlayer>();

  const playerFor = (clipId: string): ExpoPlayer | undefined => {
    const existing = players.get(clipId);
    if (existing) return existing;
    const source = CLIP_SOURCES[clipId];
    if (source === undefined) return undefined;
    const player = createAudioPlayer(source);
    players.set(clipId, player);
    return player;
  };

  return {
    async preload() {
      await setDrivingAudioMode();
      for (const clipId of Object.keys(CLIP_SOURCES)) playerFor(clipId);
    },
    play(type: LiveAlertType, ctx?: AlertContext): boolean {
      const player = playerFor(clipIdFor(type, ctx?.limitMph));
      if (!player) return false;
      if (!cooldown.tryAcquire(type, now())) return false;
      // One voice at a time: a new alert cuts off one still playing.
      for (const other of players.values()) if (other !== player && other.playing) other.pause();
      player
        .seekTo(0)
        .then(() => player.play())
        .catch((e: unknown) => console.warn('[voice] alert playback failed:', e));
      return true;
    },
    reset() {
      cooldown.reset();
    },
  };
}

/** Streams the ElevenLabs debrief (§11) and reports progress so the coaching chat can follow along. */
export function createDebriefPlayer(apiBaseUrl: string = API_BASE_URL): DebriefPlayer {
  let player: ExpoPlayer | null = null;
  const stop = () => {
    player?.pause();
    player?.remove();
    player = null;
  };
  return {
    async play(url: string) {
      stop();
      await setDrivingAudioMode();
      player = createAudioPlayer({ uri: resolveAudioUrl(url, apiBaseUrl) });
      player.play();
    },
    stop,
    pause() {
      player?.pause();
    },
    resume() {
      player?.play();
    },
    positionS() {
      return player?.currentTime ?? 0;
    },
    durationS() {
      return player?.isLoaded && player.duration > 0 ? player.duration : null;
    },
    isPlaying() {
      return player?.playing ?? false;
    },
  };
}
