/**
 * Score over time, with Weekly / Monthly / All-Time tabs. Hand-built in
 * react-native-svg so the line stays straight and sharp: a polyline never
 * interpolates between points, so the chart can't imply a score nobody drove.
 *
 * All the filtering, bucketing and averaging lives in lib/trend.ts; this only
 * draws what that returns. There is no goal or target line: that would be a new
 * threshold, and those belong in packages/shared/src/thresholds.ts.
 */
import type { QualifyingTrip } from '@eduway/shared';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { buildTrend, type TrendView } from '../lib/trend';
import { colors, font, fonts, radius, space, stroke } from '../theme';
import { PressableScale } from './motion';
import { Muted } from './primitives';

const TABS: { view: TrendView; label: string }[] = [
  { view: 'weekly', label: 'Weekly' },
  { view: 'monthly', label: 'Monthly' },
  { view: 'all-time', label: 'All-Time' },
];

const CHART_HEIGHT = 180;
/** Room for the y labels on the left and the x labels underneath. */
const PAD = { left: 30, right: 14, top: 16, bottom: 22 } as const;
/** Scores always read against a full 0 to 100 axis, never a zoomed one. */
const Y_TICKS = [0, 50, 100];
const MAX_X_LABELS = 6;
const DOT_R = 3.5;
const BEST_R = 5.5;
/** Invisible circle around each dot, so a fingertip can hit it. */
const HIT_R = 14;
const CALLOUT_W = 168;
/** How far the "Best" label needs from an edge before it stops being centered. */
const BEST_LABEL_MARGIN = 28;

interface ScoreTrendChartProps {
  trips: QualifyingTrip[];
  defaultView?: TrendView;
}

export function ScoreTrendChart({ trips, defaultView = 'weekly' }: ScoreTrendChartProps) {
  const [view, setView] = useState<TrendView>(defaultView);
  const [width, setWidth] = useState(0);
  const [openPoint, setOpenPoint] = useState<number | null>(null);

  const trend = useMemo(() => buildTrend(trips, view, new Date()), [trips, view]);
  const { points, best } = trend;

  const plotLeft = PAD.left;
  const plotRight = Math.max(plotLeft, width - PAD.right);
  const plotTop = PAD.top;
  const plotBottom = CHART_HEIGHT - PAD.bottom;

  const xAt = (i: number) =>
    points.length < 2
      ? (plotLeft + plotRight) / 2
      : plotLeft + (i / (points.length - 1)) * (plotRight - plotLeft);
  const yAt = (value: number) => plotBottom - (value / 100) * (plotBottom - plotTop);

  const labelStride = Math.max(1, Math.ceil(points.length / MAX_X_LABELS));
  const open = openPoint != null ? points[openPoint] : undefined;

  const showTab = (next: TrendView) => {
    setView(next);
    setOpenPoint(null);
  };

  return (
    <View>
      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const active = tab.view === view;
          return (
            <PressableScale
              key={tab.view}
              style={styles.tab}
              contentStyle={[styles.tabInner, active && styles.tabInnerActive]}
              onPress={() => showTab(tab.view)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </PressableScale>
          );
        })}
      </View>

      {points.length === 0 ? (
        <Muted>Scores show up after your first scored drive.</Muted>
      ) : (
        <View
          style={styles.plot}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessibilityLabel={`Score trend, ${points.length} ${points.length === 1 ? 'point' : 'points'}`}
        >
          {width > 0 ? (
            <Svg width={width} height={CHART_HEIGHT}>
              {Y_TICKS.map((tick) => (
                <Line
                  key={tick}
                  x1={plotLeft}
                  y1={yAt(tick)}
                  x2={plotRight}
                  y2={yAt(tick)}
                  stroke={colors.border}
                  strokeWidth={stroke.hairline}
                />
              ))}
              {Y_TICKS.map((tick) => (
                <SvgText
                  key={`y${tick}`}
                  x={plotLeft - 6}
                  y={yAt(tick) + 4}
                  textAnchor="end"
                  fontSize={font.tiny}
                  fontFamily={fonts.regular}
                  fill={colors.textMuted}
                >
                  {tick}
                </SvgText>
              ))}

              {points.length > 1 ? (
                <Polyline
                  points={points.map((p, i) => `${xAt(i)},${yAt(p.value)}`).join(' ')}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={stroke.outline}
                  strokeLinejoin="round"
                />
              ) : null}

              {points.map((p, i) => {
                const isBest = best?.index === i;
                return (
                  <Circle
                    key={`dot${i}`}
                    cx={xAt(i)}
                    cy={yAt(p.value)}
                    r={isBest ? BEST_R : DOT_R}
                    fill={isBest ? colors.good : colors.primary}
                  />
                );
              })}

              {best ? (
                <SvgText
                  x={xAt(best.index)}
                  y={Math.max(font.tiny, yAt(best.value) - BEST_R - 5)}
                  textAnchor={bestAnchor(xAt(best.index), plotLeft, plotRight)}
                  fontSize={font.tiny}
                  fontFamily={fonts.semiBold}
                  fill={colors.good}
                >
                  {`Best ${best.value}`}
                </SvgText>
              ) : null}

              {points.map((p, i) =>
                i % labelStride === 0 ? (
                  <SvgText
                    key={`x${i}`}
                    x={xAt(i)}
                    y={CHART_HEIGHT - 6}
                    textAnchor="middle"
                    fontSize={font.tiny}
                    fontFamily={fonts.regular}
                    fill={colors.textMuted}
                  >
                    {p.label}
                  </SvgText>
                ) : null,
              )}

              {points.map((p, i) => (
                <Circle
                  key={`hit${i}`}
                  cx={xAt(i)}
                  cy={yAt(p.value)}
                  r={HIT_R}
                  fill="transparent"
                  onPress={() => setOpenPoint((prev) => (prev === i ? null : i))}
                />
              ))}
            </Svg>
          ) : null}

          {open && openPoint != null ? (
            <View
              style={[
                styles.callout,
                { left: clamp(xAt(openPoint) - CALLOUT_W / 2, 0, Math.max(0, width - CALLOUT_W)) },
                // Above the dot, or below it for high scores, so it always fits.
                yAt(open.value) < CHART_HEIGHT / 2
                  ? { top: yAt(open.value) + HIT_R }
                  : { bottom: CHART_HEIGHT - yAt(open.value) + HIT_R },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.calloutText}>{open.tooltip}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Keeps the best label inside the plot when the best point sits at an edge. */
function bestAnchor(x: number, left: number, right: number): 'start' | 'middle' | 'end' {
  if (x - left < BEST_LABEL_MARGIN) return 'start';
  if (right - x < BEST_LABEL_MARGIN) return 'end';
  return 'middle';
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  tab: { flex: 1 },
  tabInner: {
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: stroke.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  tabInnerActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabLabel: { fontFamily: fonts.semiBold, fontSize: font.small, color: colors.textMuted },
  tabLabelActive: { color: colors.onColor },
  plot: {
    height: CHART_HEIGHT,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  callout: {
    position: 'absolute',
    width: CALLOUT_W,
    backgroundColor: colors.teal900,
    borderRadius: radius.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
  },
  calloutText: {
    fontFamily: fonts.regular,
    fontSize: font.tiny,
    color: colors.textOnDark,
    textAlign: 'center',
  },
});
