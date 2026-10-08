/**
 * Share card (§12 "Share card"): a Strava-style story image of the drive. The
 * route is drawn by us (no map tiles) with a privacy zone trimmed off each end,
 * plus distance, time, score and Gemini's share_caption when there is one.
 * Previewed full screen; "Share" renders it to a 1080x1920 PNG for the share sheet.
 */
import { useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import type { Trip } from '@eduway/shared';

import { dateText } from '../lib/format';
import type { MapPoint } from '../lib/geo';
import { routePolyline, shareStats, trimRoute, wrapText } from '../lib/shareCard';
import { colors, font, fonts, SAFE_BOTTOM, SAFE_TOP, space } from '../theme';
import { Button } from './Button';
import { sharePng } from './sharePng';

/** Instagram story size. */
const W = 1080;
const H = 1920;
const ROUTE_BOX = { x: 140, y: 340, width: 800, height: 800 };
const CAPTION_CHARS = 30;
/** Big stat numbers shrink so long values ("1 h 5 min") stay inside their column. */
const statFontSize = (value: string, colW: number) =>
  Math.min(84, Math.floor((colW - 24) / (value.length * 0.62)));
/** Width of one stat column. */
const STAT_W = (count: number) => (W - 180) / count;

type ShareTrip = Pick<Trip, '_id' | 'startedAt' | 'endedAt' | 'distanceMi' | 'score' | 'coach'>;

export function ShareDriveSheet({
  visible,
  onClose,
  trip,
  route,
}: {
  visible: boolean;
  onClose: () => void;
  trip: ShareTrip;
  route: MapPoint[];
}) {
  const svgRef = useRef<Svg>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kept = useMemo(() => trimRoute(route), [route]);
  const line = useMemo(() => routePolyline(kept, ROUTE_BOX), [kept]);
  const ends = line
    ? [line.split(' ')[0]!, line.split(' ').at(-1)!].map((p) => p.split(',').map(Number))
    : [];
  const stats = shareStats(trip);
  const caption = trip.coach?.share_caption
    ? wrapText(trip.coach.share_caption, CAPTION_CHARS)
    : [];
  const captionH = 80 + caption.length * 60;

  const share = () => {
    const svg = svgRef.current;
    if (!svg || busy) return;
    setBusy(true);
    setError(null);
    svg.toDataURL(
      (base64) => {
        sharePng(base64, `eduway-drive-${trip._id}.png`, 'Share your drive')
          .catch(() => setError("Couldn't open sharing on this device."))
          .finally(() => setBusy(false));
      },
      { width: W, height: H },
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <View style={styles.preview}>
          <Svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
            <Rect x={0} y={0} width={W} height={H} fill={colors.primary} />
            {/* The lip: a darker band along the bottom edge. */}
            <Rect x={0} y={H - 28} width={W} height={28} fill={colors.primaryLip} />

            <SvgText x={90} y={170} fill={colors.onColor} fontSize={64} fontFamily={fonts.semiBold}>
              EduWay
            </SvgText>
            <SvgText x={90} y={235} fill={colors.teal100} fontSize={38} fontFamily={fonts.regular}>
              {dateText(trip.startedAt)}
            </SvgText>

            {line ? (
              <>
                {/* Route with its own lip: a darker copy just below it. */}
                <Polyline
                  points={line}
                  fill="none"
                  stroke={colors.teal900}
                  strokeWidth={22}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="translate(0 8)"
                />
                <Polyline
                  points={line}
                  fill="none"
                  stroke={colors.onColor}
                  strokeWidth={22}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {ends.map(([x, y], i) => (
                  <Circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={20}
                    fill={colors.teal900}
                    stroke={colors.onColor}
                    strokeWidth={8}
                  />
                ))}
              </>
            ) : (
              <SvgText
                x={W / 2}
                y={ROUTE_BOX.y + ROUTE_BOX.height / 2}
                textAnchor="middle"
                fill={colors.teal100}
                fontSize={44}
                fontFamily={fonts.regular}
              >
                Short drive, route hidden for privacy
              </SvgText>
            )}

            {stats.map((s, i) => {
              const x = 90 + STAT_W(stats.length) * (i + 0.5);
              return (
                <G key={s.label}>
                  <SvgText
                    x={x}
                    y={1310}
                    textAnchor="middle"
                    fill={colors.onColor}
                    fontSize={statFontSize(s.value, STAT_W(stats.length))}
                    fontFamily={fonts.semiBold}
                  >
                    {s.value}
                  </SvgText>
                  <SvgText
                    x={x}
                    y={1370}
                    textAnchor="middle"
                    fill={colors.teal100}
                    fontSize={38}
                    fontFamily={fonts.regular}
                  >
                    {s.label}
                  </SvgText>
                </G>
              );
            })}

            {caption.length > 0 ? (
              <>
                <Rect
                  x={90}
                  y={1470 + 8}
                  width={W - 180}
                  height={captionH}
                  rx={40}
                  fill={colors.teal700}
                />
                <Rect
                  x={90}
                  y={1470}
                  width={W - 180}
                  height={captionH}
                  rx={40}
                  fill={colors.surface}
                />
                {caption.map((l, i) => (
                  <SvgText
                    key={i}
                    x={W / 2}
                    y={1470 + 80 + i * 60}
                    textAnchor="middle"
                    fill={colors.teal900}
                    fontSize={44}
                    fontFamily={fonts.semiBold}
                  >
                    {l}
                  </SvgText>
                ))}
              </>
            ) : null}

            <SvgText
              x={W / 2}
              y={H - 90}
              textAnchor="middle"
              fill={colors.teal100}
              fontSize={34}
              fontFamily={fonts.regular}
            >
              Practice drive with my EduWay coach
            </SvgText>
          </Svg>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Button title="Close" variant="secondary" onPress={onClose} style={styles.action} />
          <Button
            title={busy ? 'Preparing…' : 'Share'}
            onPress={share}
            disabled={busy}
            style={styles.action}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: SAFE_TOP,
    paddingBottom: SAFE_BOTTOM + space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  preview: { flex: 1, aspectRatio: W / H, alignSelf: 'center', maxWidth: '100%' },
  error: {
    fontFamily: fonts.regular,
    fontSize: font.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
