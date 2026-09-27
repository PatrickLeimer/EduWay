/**
 * Your coach: the last step of the post-trip flow (lib/flow.ts, §10, §11).
 * The Gemini coaching as a chat: each bubble appears as the ElevenLabs voice
 * starts saying it (CoachOutput.chat_audio_starts_s), with a typing indicator
 * just before. The student only listens; there is no input.
 *
 * Without audio (voice failed, offline, older trip) the chat plays out at a
 * reading pace instead. Timing rules live in lib/chat.ts (pure, tested).
 *
 * A trip saved without coaching (Gemini busy or out of quota) shows "Try
 * again", which asks the server to coach it now (ApiClient.retryCoaching).
 */
import type { CoachOutput, GetTripResponse } from '@edudriver/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useApiQuery } from '../../api';
import { Button } from '../components/Button';
import { BackButton } from '../components/Screen';
import { StreetViewCard } from '../components/StreetViewCard';
import { FlowFooter } from '../components/FlowFooter';
import { FadeIn, useReducedMotion } from '../components/motion';
import { ConnectionError } from '../components/ConnectionError';
import { chatMessages, chatProgress, chatSchedule, readingDurationS } from '../lib/chat';
import { nextRoute, prevRoute } from '../lib/flow';
import { dateText } from '../lib/format';
import type { FlowOrigin, ScreenProps } from '../navigation';
import {
  colors,
  font,
  fonts,
  motion,
  radius,
  SAFE_BOTTOM,
  SAFE_TOP,
  space,
  stroke,
} from '../theme';

/** Shown in the header; the voice is ElevenLabs "Chris" (scripts/alert-clips, server/.env). */
const COACH_NAME = 'Coach Chris';
const TICK_MS = 150;
/** Give up on the audio and fall back to reading pace if it hasn't started by then. */
const AUDIO_START_TIMEOUT_MS = 8000;

type Phase = 'loading' | 'playing' | 'paused' | 'finished';

/** Three dots that pulse one after another, like someone typing. */
function TypingDots() {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, v]);
  return (
    <View style={[styles.bubble, styles.typing]} accessibilityLabel={`${COACH_NAME} is typing`}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: v.interpolate({
                inputRange: [0, (i + 0.5) / 4, (i + 1.5) / 4, 1],
                outputRange: [0.3, 1, 0.3, 0.3],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Little equalizer bars next to the coach's name while the voice is playing. */
function SoundBars({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced || !active) return;
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      v.setValue(0);
    };
  }, [active, reduced, v]);
  return (
    <View style={styles.bars}>
      {[0, 1, 2, 3].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              transform: [
                {
                  scaleY: v.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: i % 2 ? [0.4, 1, 0.4] : [1, 0.4, 1],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function Avatar({ size }: { size: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>C</Text>
    </View>
  );
}

/** Focus areas and strengths, shown once the coach has finished talking. */
function Takeaways({ coach }: { coach: CoachOutput }) {
  if (coach.focus_areas.length === 0 && coach.strengths.length === 0) return null;
  return (
    <FadeIn fromY={16} duration={motion.slow} style={styles.takeaways}>
      <Text style={styles.takeawaysTitle}>Your takeaways</Text>
      {coach.focus_areas.map((f, i) => (
        <View key={f.skill} style={styles.focus}>
          <View style={styles.focusNum}>
            <Text style={styles.focusNumText}>{i + 1}</Text>
          </View>
          <View style={styles.focusText}>
            <Text style={styles.focusSkill}>{f.skill}</Text>
            <Text style={styles.focusTip}>{f.tip}</Text>
          </View>
        </View>
      ))}
      {coach.strengths.length > 0 ? (
        <View style={styles.chips}>
          {coach.strengths.map((s) => (
            <View key={s} style={styles.chip}>
              <Text style={styles.chipText}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </FadeIn>
  );
}

export function CoachScreen({
  modules,
  navigate,
  tripId,
  origin,
}: ScreenProps & { tripId: string; origin: FlowOrigin }) {
  const q = useApiQuery(`trip:${tripId}`, () => modules.api.getTrip(tripId));
  // "Try again": the retried debrief replaces the loaded one once it arrives.
  const [retried, setRetried] = useState<GetTripResponse | null>(null);
  const [retry, setRetry] = useState<'idle' | 'working' | 'failed'>('idle');
  const trip = (retried ?? q.data)?.trip;
  const coach = trip?.coach ?? null;
  const streetView = (retried ?? q.data)?.streetView ?? null;
  const audioUrl = trip && !trip.passenger ? trip.coachAudioUrl : null;
  const messages = useMemo(() => (coach ? chatMessages(coach) : []), [coach]);
  const debrief = modules.debrief;

  // Playback clock: the debrief audio when there is one, else a local reading clock.
  const [useAudio, setUseAudio] = useState(true);
  const [positionS, setPositionS] = useState(0);
  const [durationS, setDurationS] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [showAll, setShowAll] = useState(false);
  const clock = useRef({ startedAt: 0, pausedAtS: null as number | null, audioStartedAt: 0 });

  const audioMode = useAudio && !!audioUrl;
  const hasServerTimings = !!coach?.chat_audio_starts_s?.some((s) => s > 0);
  const schedule = useMemo(() => {
    if (audioMode && !hasServerTimings && durationS == null) return null; // wait for the audio length
    return chatSchedule(messages, coach?.chat_audio_starts_s, audioMode ? durationS : null);
  }, [audioMode, hasServerTimings, durationS, messages, coach]);
  const readEndS = useMemo(
    () => (schedule ? readingDurationS(messages, schedule) : 0),
    [messages, schedule],
  );

  const start = useCallback(() => {
    setShowAll(false);
    setPositionS(0);
    setPhase('playing');
    clock.current = { startedAt: Date.now(), pausedAtS: null, audioStartedAt: Date.now() };
    if (audioMode && audioUrl) {
      debrief.play(audioUrl).catch(() => {
        clock.current.startedAt = Date.now();
        setUseAudio(false);
      });
    }
  }, [audioMode, audioUrl, debrief]);

  // Start once the coaching has loaded; stop the voice when leaving the screen.
  const started = useRef(false);
  useEffect(() => {
    if (!coach || started.current) return;
    started.current = true;
    start();
  }, [coach, start]);
  useEffect(() => () => debrief.stop(), [debrief]);

  // Tick: read the audio position (or the reading clock) and advance the chat.
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      if (audioMode) {
        const pos = debrief.positionS();
        const dur = debrief.durationS();
        setPositionS(pos);
        if (dur != null) setDurationS(dur);
        if (pos === 0 && Date.now() - clock.current.audioStartedAt > AUDIO_START_TIMEOUT_MS) {
          // The audio never started (network, format): read instead.
          debrief.stop();
          clock.current.startedAt = Date.now();
          setUseAudio(false);
        } else if (dur != null && pos > 0 && !debrief.isPlaying() && pos >= dur - 0.25) {
          setPhase('finished');
        }
      } else {
        const pos = (Date.now() - clock.current.startedAt) / 1000;
        setPositionS(pos);
        if (pos >= readEndS) setPhase('finished');
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, audioMode, debrief, readEndS]);

  const pause = () => {
    if (audioMode) debrief.pause();
    clock.current.pausedAtS = positionS;
    setPhase('paused');
  };
  const resume = () => {
    if (audioMode) debrief.resume();
    else clock.current.startedAt = Date.now() - (clock.current.pausedAtS ?? 0) * 1000;
    clock.current.pausedAtS = null;
    setPhase('playing');
  };
  const revealAll = () => {
    setShowAll(true);
    if (audioMode) debrief.stop();
    setPhase('finished');
  };

  const progress =
    showAll || phase === 'finished'
      ? { visible: messages.length, typing: false }
      : schedule
        ? chatProgress(schedule, positionS)
        : { visible: 0, typing: true };

  // Keep the newest bubble in view.
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [progress.visible, progress.typing, phase]);

  const tryAgain = () => {
    setRetry('working');
    modules.api.retryCoaching(tripId).then(
      (res) => {
        setRetried(res);
        setRetry(res.trip.coach ? 'idle' : 'failed');
      },
      () => setRetry('failed'),
    );
  };

  const finish = () => {
    debrief.stop();
    if (origin === 'trip') modules.trip.reset();
    navigate(nextRoute('coach', tripId, origin));
  };

  const status =
    phase === 'finished'
      ? 'Finished'
      : phase === 'paused'
        ? 'Paused'
        : coach
          ? audioMode
            ? 'Talking…'
            : 'Typing…'
          : 'Getting ready…';

  let chat;
  if (!q.data) {
    chat = q.error ? (
      <ConnectionError error={q.error} onRetry={q.reload} />
    ) : (
      <ActivityIndicator color={colors.route} style={styles.loading} />
    );
  } else if (trip?.passenger) {
    chat = (
      <View style={[styles.bubble, styles.firstBubble]}>
        <Text style={styles.bubbleText}>
          This was a passenger trip, so there’s nothing to coach. See you when you’re behind the
          wheel!
        </Text>
      </View>
    );
  } else if (!coach) {
    chat = (
      <>
        <View style={[styles.bubble, styles.firstBubble]}>
          <Text style={styles.bubbleText}>
            {retry === 'failed'
              ? 'Still can’t get through, sorry. Give it a minute and try again. Your replay and infractions are saved either way.'
              : 'I couldn’t review this drive just now. Your replay and infractions are saved. Tap Try again and I’ll give it another go.'}
          </Text>
        </View>
        {retry === 'working' ? <TypingDots /> : null}
        <View style={styles.retry}>
          <Button
            title={retry === 'working' ? 'Trying again…' : 'Try again'}
            disabled={retry === 'working'}
            onPress={tryAgain}
          />
        </View>
      </>
    );
  } else {
    chat = (
      <>
        {messages.slice(0, progress.visible).map((m, i) => (
          <FadeIn key={i} fromY={12} fromScale={0.96} duration={motion.normal}>
            <View style={[styles.bubble, i === 0 && styles.firstBubble]}>
              <Text style={styles.bubbleText}>{m}</Text>
            </View>
          </FadeIn>
        ))}
        {progress.typing ? <TypingDots /> : null}
        {/* Street View (§12): the spot the coach pulled up, once they're done talking. */}
        {phase === 'finished' && streetView ? (
          <FadeIn fromY={16} duration={motion.slow}>
            <StreetViewCard callout={streetView} />
          </FadeIn>
        ) : null}
        {phase === 'finished' ? <Takeaways coach={coach} /> : null}
      </>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <BackButton label="Growth" onPress={() => navigate(prevRoute('coach', tripId, origin))} />
        <FadeIn fromY={8} style={styles.identity}>
          <Avatar size={56} />
          <View style={styles.identityText}>
            <Text style={styles.name}>{COACH_NAME}</Text>
            <View style={styles.statusRow}>
              <SoundBars active={phase === 'playing' && audioMode && !!coach} />
              <Text style={styles.status}>{status}</Text>
            </View>
          </View>
        </FadeIn>
      </View>

      <ScrollView ref={scroll} style={styles.chatArea} contentContainerStyle={styles.chatContent}>
        <Text style={styles.dayChip}>
          After-drive coaching{trip ? ` · ${dateText(trip.startedAt)}` : ''}
        </Text>
        {chat}
      </ScrollView>

      {coach ? (
        <View style={styles.controls}>
          {phase === 'playing' ? (
            <ControlButton label="Pause" onPress={pause} />
          ) : phase === 'paused' ? (
            <ControlButton label="Resume" onPress={resume} />
          ) : null}
          <ControlButton label="Replay" onPress={start} />
          {phase !== 'finished' ? <ControlButton label="Show all" onPress={revealAll} /> : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <FlowFooter step="coach" title="Done" onPress={finish} />
      </View>
    </View>
  );
}

function ControlButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
    >
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingTop: SAFE_TOP,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  identityText: { gap: 2 },
  avatar: { backgroundColor: colors.route, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontFamily: fonts.semiBold },
  name: { fontSize: font.title, fontFamily: fonts.semiBold, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  status: { fontSize: font.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 14 },
  bar: { width: 3, height: 14, borderRadius: 2, backgroundColor: colors.route },
  chatArea: { flex: 1, backgroundColor: colors.surfaceAlt },
  chatContent: { padding: space.lg, gap: space.sm, paddingBottom: space.xl },
  dayChip: {
    fontFamily: fonts.regular,
    alignSelf: 'center',
    fontSize: font.small,
    color: colors.textMuted,
    marginBottom: space.sm,
  },
  loading: { marginTop: space.xxl },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderTopLeftRadius: 6,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderWidth: stroke.hairline,
    borderColor: colors.border,
  },
  firstBubble: { marginTop: space.xs },
  retry: { alignSelf: 'flex-start', marginTop: space.sm },
  bubbleText: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.text },
  typing: { flexDirection: 'row', gap: 6, paddingVertical: space.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
  takeaways: {
    marginTop: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  takeawaysTitle: { fontSize: font.title, fontFamily: fonts.semiBold, color: colors.text },
  focus: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  focusNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.route,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusNumText: { color: colors.white, fontFamily: fonts.semiBold },
  focusText: { flex: 1, gap: 2 },
  focusSkill: { fontSize: font.body, fontFamily: fonts.semiBold, color: colors.text },
  focusTip: {
    fontFamily: fonts.regular,
    fontSize: font.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    backgroundColor: colors.goodSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  chipText: { fontSize: font.small, color: colors.good, fontFamily: fonts.semiBold },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    backgroundColor: colors.surfaceAlt,
  },
  control: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlPressed: { opacity: 0.6 },
  controlText: { fontSize: font.body, fontFamily: fonts.semiBold, color: colors.text },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: SAFE_BOTTOM + space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
