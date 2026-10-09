/**
 * Share card (§12 "Share card"): a Strava-style story image of the drive.
 * The middle of the card is a map snapshot (satellite or streets) of the route
 * with a privacy zone trimmed off each end; around it, distance, time, score
 * and Gemini's share_caption when there is one.
 *
 * The map is a hidden MapCanvas laid out at exactly the snapshot size (Android
 * snapshots the view itself), behind the preview. Without a map (browser, map
 * failed, very short drive) the card falls back to the route drawn on teal.
 * "Share" captures an off-screen copy of the card at exactly 1080x1920 pixels.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PixelRatio, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Image, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import type { Trip } from '@eduway/shared';

import { dateText } from '../lib/format';
import type { MapPoint } from '../lib/geo';
import { routePolyline, shareStats, trimRoute, wrapText } from '../lib/shareCard';
import { colors, font, fonts, SAFE_BOTTOM, SAFE_TOP, space } from '../theme';
import { Button } from './Button';
import { MapCanvas } from './MapCanvas';
import type { MapSnapshot } from './mapTypes';
import { sharePng } from './sharePng';

/** Instagram story size. */
const W = 1080;
const H = 1920;
/** Teal header above the map. */
const HEADER_H = 280;
/** The map band. */
const MAP_Y = HEADER_H;
const MAP_H = 1000;
/** Where the drawn route goes when there is no map image. */
const ROUTE_BOX = { x: 140, y: MAP_Y + 80, width: 800, height: MAP_H - 160 };
const STATS_Y = MAP_Y + MAP_H + 125;
const CAPTION_Y = STATS_Y + 105;
const CAPTION_CHARS = 30;
/** Big stat numbers shrink so long values ("1 h 5 min") stay inside their column. */
const statFontSize = (value: string, colW: number) =>
  Math.min(84, Math.floor((colW - 24) / (value.length * 0.62)));
/** Width of one stat column. */
const STAT_W = (count: number) => (W - 180) / count;
/** After the map reports drawn, give the route line a moment before the snapshot. */
const SNAPSHOT_DELAY_MS = 700;
/** Give up on the map after this long and share the drawn route instead. */
const MAP_TIMEOUT_MS = 12_000;
const MAP_CREDIT = Platform.OS === 'ios' ? 'Maps © Apple' : 'Map data © Google';

type ShareTrip = Pick<Trip, '_id' | 'startedAt' | 'endedAt' | 'distanceMi' | 'score' | 'coach'>;
type Basemap = 'satellite' | 'streets';
/** A finished map snapshot; image null = the map failed or timed out. */
type MapShot = { image: string | null };

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
  const snapshotRef = useRef<MapSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<Basemap>('satellite');
  /** One snapshot per basemap, so switching back is instant. */
  const [shots, setShots] = useState<Partial<Record<Basemap, MapShot>>>({});

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

  const wantsMap = visible && kept.length >= 2 && Platform.OS !== 'web';
  const mapW = W / PixelRatio.get();
  const mapH = MAP_H / PixelRatio.get();

  const shot = wantsMap ? shots[basemap] : undefined;
  const mapImage = shot?.image ?? null;
  const mapLoading = wantsMap && !shot;

  // Give up on a map that never loads; the card then shows the drawn route.
  useEffect(() => {
    if (!wantsMap) return;
    const timeout = setTimeout(() => {
      setShots((s) => (s[basemap] ? s : { ...s, [basemap]: { image: null } }));
    }, MAP_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [wantsMap, basemap]);

  /** The hidden map for `forBasemap` finished drawing: snapshot it. */
  const onMapLoaded = (forBasemap: Basemap) => {
    setTimeout(() => {
      snapshotRef.current
        ?.take(mapW, mapH)
        .then((image) => setShots((s) => ({ ...s, [forBasemap]: { image } })))
        .catch(() => setShots((s) => ({ ...s, [forBasemap]: { image: null } })));
    }, SNAPSHOT_DELAY_MS);
  };

  const share = () => {
    const svg = svgRef.current;
    if (!svg || busy || mapLoading) return;
    setBusy(true);
    setError(null);
    svg.toDataURL((base64) => {
      sharePng(base64, `eduway-drive-${trip._id}.png`, 'Share your drive')
        .catch(() => setError("Couldn't open sharing on this device."))
        .finally(() => setBusy(false));
    });
  };

  const art = (
    <>
      <Rect x={0} y={0} width={W} height={H} fill={colors.primary} />

      {mapImage ? (
        <Image
          x={0}
          y={MAP_Y}
          width={W}
          height={MAP_H}
          href={`data:image/jpeg;base64,${mapImage}`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : line ? (
        <>
          {/* No map image: the route drawn on teal, with its own lip. */}
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
          y={MAP_Y + MAP_H / 2}
          textAnchor="middle"
          fill={colors.teal100}
          fontSize={44}
          fontFamily={fonts.regular}
        >
          Short drive, route hidden for privacy
        </SvgText>
      )}

      {/* Header band over the top of the map, with a lip along its bottom edge. */}
      <Rect x={0} y={0} width={W} height={HEADER_H} fill={colors.primary} />
      <Rect x={0} y={HEADER_H - 14} width={W} height={14} fill={colors.primaryLip} />
      <SvgText x={90} y={150} fill={colors.onColor} fontSize={64} fontFamily={fonts.semiBold}>
        EduWay
      </SvgText>
      <SvgText x={90} y={215} fill={colors.teal100} fontSize={38} fontFamily={fonts.regular}>
        {dateText(trip.startedAt)}
      </SvgText>

      {/* Bottom panel under the map, with a lip along its top edge. */}
      <Rect x={0} y={MAP_Y + MAP_H} width={W} height={H - MAP_Y - MAP_H} fill={colors.primary} />
      <Rect x={0} y={MAP_Y + MAP_H} width={W} height={14} fill={colors.primaryLip} />

      {stats.map((s, i) => {
        const x = 90 + STAT_W(stats.length) * (i + 0.5);
        return (
          <G key={s.label}>
            <SvgText
              x={x}
              y={STATS_Y}
              textAnchor="middle"
              fill={colors.onColor}
              fontSize={statFontSize(s.value, STAT_W(stats.length))}
              fontFamily={fonts.semiBold}
            >
              {s.value}
            </SvgText>
            <SvgText
              x={x}
              y={STATS_Y + 55}
              textAnchor="middle"
              fill={colors.teal100}
              fontSize={36}
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
            y={CAPTION_Y + 8}
            width={W - 180}
            height={captionH}
            rx={40}
            fill={colors.teal700}
          />
          <Rect
            x={90}
            y={CAPTION_Y}
            width={W - 180}
            height={captionH}
            rx={40}
            fill={colors.surface}
          />
          {caption.map((l, i) => (
            <SvgText
              key={i}
              x={W / 2}
              y={CAPTION_Y + 80 + i * 60}
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
        y={H - 70}
        textAnchor="middle"
        fill={colors.teal100}
        fontSize={34}
        fontFamily={fonts.regular}
      >
        Practice drive with my EduWay coach
      </SvgText>
      {mapImage ? (
        <SvgText
          x={W - 40}
          y={MAP_Y + MAP_H - 24}
          textAnchor="end"
          fill={colors.onColor}
          fontSize={24}
          fontFamily={fonts.regular}
        >
          {MAP_CREDIT}
        </SvgText>
      ) : null}
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/*
          The map that gets snapshotted, laid out at exactly the map band's
          pixel size and hidden behind the sheet. Remounted per basemap so it
          reports loaded again.
        */}
        {wantsMap && !shot ? (
          <MapCanvas
            key={basemap}
            style={{ ...styles.hiddenMap, width: mapW, height: mapH }}
            route={kept}
            fitTo={kept}
            interactive={false}
            satellite={basemap === 'satellite'}
            boldRoute
            onLoaded={() => onMapLoaded(basemap)}
            snapshotRef={snapshotRef}
          />
        ) : null}

        <View style={styles.sheet}>
          <View style={styles.preview}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
              {art}
            </Svg>
            {mapLoading ? (
              <View style={styles.loadingBadge}>
                <Text style={styles.loadingText}>Loading map…</Text>
              </View>
            ) : null}
          </View>
          {/*
            The copy that becomes the PNG, off screen and exactly 1080x1920 pixels.
            toDataURL draws at the view's own size, so capturing the small preview
            gave a small image.
          */}
          <View style={styles.capture} pointerEvents="none">
            <Svg
              ref={svgRef}
              width={W / PixelRatio.get()}
              height={H / PixelRatio.get()}
              viewBox={`0 0 ${W} ${H}`}
            >
              {art}
            </Svg>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {wantsMap ? (
            <View style={styles.actions}>
              <Button
                title="Satellite"
                variant={basemap === 'satellite' ? 'primary' : 'secondary'}
                onPress={() => setBasemap('satellite')}
                style={styles.action}
              />
              <Button
                title="Streets"
                variant={basemap === 'streets' ? 'primary' : 'secondary'}
                onPress={() => setBasemap('streets')}
                style={styles.action}
              />
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button title="Close" variant="secondary" onPress={onClose} style={styles.action} />
            <Button
              title={busy ? 'Preparing…' : 'Share'}
              onPress={share}
              disabled={busy || mapLoading}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  /** Behind the sheet (drawn first, sheet is opaque on top). */
  hiddenMap: { position: 'absolute', top: 0, left: 0 },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: SAFE_TOP,
    paddingBottom: SAFE_BOTTOM + space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  preview: { flex: 1, aspectRatio: W / H, alignSelf: 'center', maxWidth: '100%' },
  loadingBadge: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  loadingText: { fontFamily: fonts.semiBold, fontSize: font.small, color: colors.text },
  error: {
    fontFamily: fonts.regular,
    fontSize: font.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  /** Off screen: laid out and drawable, never seen. */
  capture: { position: 'absolute', left: -10000, top: 0 },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
