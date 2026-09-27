/**
 * Screen 4 (§12, §9 "Replay"): full route, a car that moves along it, event
 * pins that pop in at their timestamps, and a speed timeline with a scrub bar
 * and 1x / 4x / 10x playback. Shows what was recorded; never re-runs detection.
 * Step 1 of the post-trip flow (lib/flow.ts); the only screen with a map.
 *
 * Known gap: the trace stores speed only, not the limit at each second, so the
 * timeline shows speed plus event ticks. A true "speed vs limit" line needs a
 * per-fix limit in the trace (contract change, WS2/WS3).
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApiQuery } from '../../api';
import { Button } from '../components/Button';
import { ConnectionError } from '../components/ConnectionError';
import { EventRow } from '../components/EventRow';
import { FlowFooter } from '../components/FlowFooter';
import { MapCanvas } from '../components/MapCanvas';
import { FadeIn, GrowBar } from '../components/motion';
import { Muted, OsmCredit } from '../components/primitives';
import { Screen } from '../components/Screen';
import { nextRoute, prevRoute } from '../lib/flow';
import { clockText } from '../lib/format';
import { pointFromGeo, pointsFromTrace } from '../lib/geo';
import {
  positionAt,
  REPLAY_SPEEDS,
  speedBuckets,
  timeEvents,
  traceDurationS,
  type ReplaySpeed,
} from '../lib/replay';
import type { FlowOrigin, ScreenProps } from '../navigation';
import { colors, font, motion, radius, space } from '../theme';

const TICK_MS = 200;
const BARS = 48;
/** How long an event stays in the "just happened" card, in replay seconds. */
const EVENT_CARD_S = 8;

export function ReplayScreen({
  modules,
  navigate,
  tripId,
  origin,
}: ScreenProps & { tripId: string; origin: FlowOrigin }) {
  const tripQ = useApiQuery(`trip:${tripId}`, () => modules.api.getTrip(tripId));
  const traceQ = useApiQuery(`trace:${tripId}`, () => modules.api.getTrace(tripId));

  const [tS, setTS] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(4);
  const [barWidth, setBarWidth] = useState(1);

  const trace = traceQ.data;
  const trip = tripQ.data?.trip;
  const durationS = trace ? traceDurationS(trace) : 0;

  const route = useMemo(() => (trace ? pointsFromTrace(trace) : []), [trace]);
  const timed = useMemo(
    () => (tripQ.data && trace ? timeEvents(tripQ.data.events, trace.startedAt) : []),
    [tripQ.data, trace],
  );
  const bars = useMemo(() => (trace ? speedBuckets(trace, BARS) : []), [trace]);
  const maxMph = Math.max(1, ...bars.map((b) => b.maxMph));

  // Playback clock. Reaching the end stops it without extra state.
  const atEnd = durationS > 0 && tS >= durationS;
  const running = playing && !atEnd;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTS((t) => Math.min(durationS, t + (TICK_MS / 1000) * speed));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, speed, durationS]);

  const back = () => navigate(prevRoute('replay', tripId, origin));
  const next = () => navigate(nextRoute('replay', tripId, origin));

  if (!trace || !trip) {
    const error = tripQ.error ?? traceQ.error;
    return (
      <Screen title="Replay" onBack={back} footer={<FlowFooter step="replay" onPress={next} />}>
        {error ? (
          <ConnectionError
            error={error}
            onRetry={() => {
              tripQ.reload();
              traceQ.reload();
            }}
          />
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        )}
      </Screen>
    );
  }

  const car = positionAt(trace, tS);
  const shown = timed.filter((e) => e.offsetS <= tS);
  const pins = shown.map((e, i) => ({
    id: String(i),
    ...pointFromGeo(e.event.location),
    color: e.event.tier === 'harsh' ? colors.harsh : colors.coach,
  }));
  const latest = shown[shown.length - 1];
  const recent = latest && tS - latest.offsetS <= EVENT_CARD_S ? latest : null;

  const togglePlay = () => {
    if (atEnd) {
      setTS(0);
      setPlaying(true);
    } else {
      setPlaying(!running);
    }
  };

  return (
    <Screen
      title="Replay"
      onBack={back}
      backLabel={origin === 'trip' ? 'Summary' : 'Past drives'}
      footer={<FlowFooter step="replay" onPress={next} />}
      hero={<MapCanvas style={styles.map} route={route} fitTo={route} pins={pins} car={car} />}
    >
      <View style={styles.eventSlot}>
        {recent ? (
          // Keyed by time so each new event pops in.
          <FadeIn key={recent.offsetS} fromY={8} fromScale={0.96} duration={motion.fast}>
            <EventRow event={recent.event} time={clockText(recent.offsetS)} />
          </FadeIn>
        ) : (
          <Muted>Events pop up here as the car reaches them.</Muted>
        )}
      </View>

      {/* Speed timeline + scrub bar: tap anywhere to jump there. */}
      <Pressable
        onLayout={(e) => setBarWidth(Math.max(1, e.nativeEvent.layout.width))}
        onPress={(e) => setTS((e.nativeEvent.locationX / barWidth) * durationS)}
        style={styles.timeline}
        accessibilityLabel="Replay timeline"
      >
        <View style={styles.bars}>
          {/* The speed profile grows left to right when the replay opens. */}
          {bars.map((b, i) => (
            <GrowBar
              key={b.startS}
              delay={i * 12}
              style={[styles.bar, { height: `${Math.max(4, (b.maxMph / maxMph) * 100)}%` }]}
            />
          ))}
        </View>
        {timed.map((e, i) => (
          <View
            key={i}
            style={[
              styles.tick,
              {
                left: `${(e.offsetS / Math.max(durationS, 1)) * 100}%`,
                backgroundColor: e.event.tier === 'harsh' ? colors.harsh : colors.coach,
              },
            ]}
          />
        ))}
        <View style={[styles.playhead, { left: `${(tS / Math.max(durationS, 1)) * 100}%` }]} />
      </Pressable>
      <View style={styles.times}>
        <Text style={styles.time}>{clockText(tS)}</Text>
        <Text style={styles.time}>
          Speed (peak {Math.round(maxMph)} mph) · {clockText(durationS)}
        </Text>
      </View>

      <View style={styles.controls}>
        <Button
          title={running ? 'Pause' : atEnd ? 'Replay again' : 'Play'}
          onPress={togglePlay}
          style={styles.playBtn}
        />
        {REPLAY_SPEEDS.map((s) => (
          <Button
            key={s}
            title={`${s}x`}
            variant={s === speed ? 'primary' : 'secondary'}
            onPress={() => setSpeed(s)}
            style={styles.speedBtn}
          />
        ))}
      </View>
      <OsmCredit />
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 320 },
  loading: { marginTop: space.xxl },
  eventSlot: { minHeight: 64, justifyContent: 'center', marginTop: space.sm },
  timeline: {
    height: 72,
    marginTop: space.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1, padding: space.xs },
  bar: { flex: 1, backgroundColor: colors.route, borderRadius: 2, opacity: 0.7 },
  tick: { position: 'absolute', top: 0, width: 3, height: 12, marginLeft: -1 },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.text,
  },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  time: { fontSize: font.small, color: colors.textMuted },
  controls: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  playBtn: { flex: 2 },
  speedBtn: { flex: 1 },
});
