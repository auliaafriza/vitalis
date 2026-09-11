import { niceAxisBounds, type DayBucket } from '@calorya/core';
import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { spacing, useTheme, useThemedStyles, type Theme } from '../lib/theme';

/**
 * The two charts the Progress screen is built from.
 *
 * Deliberately hand-drawn with react-native-svg rather than a charting
 * library: the whole surface here is one line and one column series, and a
 * library would cost more bundle than it saves code while making the specs
 * below harder to hold to.
 *
 * Those specs, applied consistently across both charts:
 *
 *   - Gridlines are 1px SOLID hairlines a single step off the surface. Dashed
 *     grid reads as a threshold or a projection when it is neither; the only
 *     dashed rule in here is the calorie target, which genuinely IS a
 *     threshold.
 *   - Lines are 2px with round caps; end markers are r=4 with a 2px ring in
 *     the surface colour so they stay legible where they cross the line.
 *   - Bars grow from a zero baseline, are capped at 24px wide, and keep a 2px
 *     gap of surface between neighbours — the gap separates them, not a
 *     stroke.
 *   - Labels are never in the series colour. The mark carries identity; the
 *     text wears text tokens, because a mid-tone hue is illegible as small
 *     text on either surface.
 *   - Values are direct-labelled selectively — the endpoint, not every point.
 *     A number on every dot is chaos and goes unread.
 *
 * And the rule that shaped the screen more than any other: **there is no
 * dual-axis chart here.** Weight and calories are different units on wildly
 * different scales, and putting them on one plot with two y-axes would let the
 * arbitrary alignment of those axes invent a correlation the data does not
 * contain. They are two panels, stacked, sharing one x-axis.
 */

const AXIS_BAND = 18; // room under the plot for the date labels
const MARKER_INSET = 6; // endpoint radius (4) + its 2px surface ring
const Y_LABEL_WIDTH = 38;

export interface ChartPoint {
  day: string;
  value: number | null;
}

/**
 * A line over time, spaced by real dates.
 *
 * The date spacing is the point. Plotting by array index — which is what this
 * screen did before — draws a three-week gap between weigh-ins exactly as wide
 * as an overnight one, so a line that looks like a steady decline can be two
 * measurements a month apart. Position on x is `daysFromStart`, always.
 */
export function LineChart({
  points,
  color,
  height = 150,
  formatValue = (v) => String(Math.round(v)),
  /** An optional second, quieter line — the smoothed trend under the raw one. */
  overlay,
  overlayLabel,
}: {
  points: readonly ChartPoint[];
  color: string;
  height?: number;
  formatValue?: (value: number) => string;
  overlay?: readonly ChartPoint[];
  overlayLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);

  const plotted = points.filter((p) => p.value !== null);
  const axis = useMemo(
    () =>
      niceAxisBounds(
        [...plotted, ...(overlay ?? []).filter((p) => p.value !== null)].map(
          (p) => p.value as number,
        ),
      ),
    [plotted, overlay],
  );

  if (plotted.length === 0) {
    return (
      <View style={[styles.frame, { height: height + AXIS_BAND }]}>
        <Text style={styles.empty}>Belum ada data pada rentang ini.</Text>
      </View>
    );
  }

  const plotWidth = Math.max(0, width - Y_LABEL_WIDTH);
  const first = points[0]!.day;
  const last = points[points.length - 1]!.day;
  const span = Math.max(1, dayDiff(first, last));

  /*
   * Room for the end marker.
   *
   * Without it the newest reading — the one the eye goes to first — sits
   * exactly on the plot's right edge, so half its dot and all of its ring are
   * clipped away. MARKER_INSET is the endpoint's radius plus its surface ring.
   */
  const usable = Math.max(0, plotWidth - MARKER_INSET * 2);
  const x = (day: string) => MARKER_INSET + (dayDiff(first, day) / span) * usable;
  const y = (value: number) =>
    height - ((value - axis.min) / (axis.max - axis.min || 1)) * height;

  const toPath = (list: readonly ChartPoint[]) => {
    /*
     * A gap in the data breaks the line rather than bridging it.
     *
     * Drawing straight through a fortnight of missing weigh-ins would show a
     * smooth trend that was never measured. `M` after every gap says "no
     * reading here" honestly.
     */
    let d = '';
    let pen = false;
    for (const p of list) {
      if (p.value === null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)} `;
      pen = true;
    }
    return d.trim();
  };

  const lastPoint = plotted[plotted.length - 1]!;

  return (
    <View style={{ marginTop: spacing.md }} onLayout={onWidth(setWidth)}>
      <View style={{ height: height + AXIS_BAND }}>
        {width > 0 ? (
          <Svg width={width} height={height + AXIS_BAND}>
            {axis.ticks.map((tick) => (
              <Line
                key={tick}
                x1={Y_LABEL_WIDTH}
                x2={width}
                y1={y(tick)}
                y2={y(tick)}
                stroke={theme.border}
                strokeWidth={1}
              />
            ))}

            <Svg x={Y_LABEL_WIDTH} y={0} width={plotWidth} height={height}>
              {overlay ? (
                <Path
                  d={toPath(overlay)}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.35}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              <Path
                d={toPath(points)}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {plotted.map((p) => (
                <Circle
                  key={p.day}
                  cx={x(p.day)}
                  cy={y(p.value as number)}
                  r={3}
                  fill={color}
                />
              ))}
              {/* The endpoint gets a ring so it reads as "you are here". */}
              <Circle
                cx={x(lastPoint.day)}
                cy={y(lastPoint.value as number)}
                r={4}
                fill={color}
                stroke={theme.surface}
                strokeWidth={2}
              />
            </Svg>
          </Svg>
        ) : null}

        {/* Axis labels as Text, not SVG text: they inherit the app's font. */}
        {width > 0
          ? axis.ticks.map((tick) => (
              <Text
                key={tick}
                style={[styles.yLabel, { top: y(tick) - 7 }]}
                numberOfLines={1}
              >
                {formatValue(tick)}
              </Text>
            ))
          : null}
      </View>

      <View style={styles.xAxis}>
        <Text style={styles.xLabel}>{shortDay(first)}</Text>
        <Text style={styles.xLabel}>{shortDay(last)}</Text>
      </View>
      {/*
        On its own line, not between the two dates. Sharing the axis row meant
        `space-between` squeezed the right-hand date against the card edge —
        fine at 390px, a collision on anything narrower.
      */}
      {overlayLabel ? <Text style={styles.legend}>{overlayLabel}</Text> : null}
    </View>
  );
}

/**
 * Columns over time, from a zero baseline.
 *
 * Zero is not negotiable for bars: a bar's length *is* its value, so a
 * truncated baseline would make 2100 kcal look like twice 1900. Days with no
 * log are drawn as a faint stub rather than a short bar, because "did not eat"
 * and "did not write it down" are different facts and a 2px bar states the
 * first one.
 */
export function BarChart({
  buckets,
  color,
  target,
  height = 150,
  formatValue = (v) => String(Math.round(v)),
}: {
  buckets: readonly DayBucket<unknown>[];
  color: string;
  target?: number | null;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);

  const values = buckets
    .map((b) => b.value)
    .filter((v): v is number => v !== null);
  const axis = useMemo(
    () => niceAxisBounds([...values, ...(target ? [target] : [])], { includeZero: true }),
    [values, target],
  );

  if (values.length === 0) {
    return (
      <View style={[styles.frame, { height: height + AXIS_BAND }]}>
        <Text style={styles.empty}>Belum ada data pada rentang ini.</Text>
      </View>
    );
  }

  const plotWidth = Math.max(0, width - Y_LABEL_WIDTH);
  const slot = plotWidth / Math.max(1, buckets.length);
  // Capped at 24px and never filling its slot: the leftover is the 2px surface
  // gap that separates neighbours without drawing a stroke around them.
  const barWidth = Math.max(2, Math.min(24, slot - 2));
  const y = (value: number) => height - (value / (axis.max || 1)) * height;

  return (
    <View style={{ marginTop: spacing.md }} onLayout={onWidth(setWidth)}>
      <View style={{ height: height + AXIS_BAND }}>
        {width > 0 ? (
          <Svg width={width} height={height + AXIS_BAND}>
            {axis.ticks.map((tick) => (
              <Line
                key={tick}
                x1={Y_LABEL_WIDTH}
                x2={width}
                y1={y(tick)}
                y2={y(tick)}
                stroke={theme.border}
                strokeWidth={1}
              />
            ))}

            <Svg x={Y_LABEL_WIDTH} y={0} width={plotWidth} height={height}>
              {buckets.map((bucket, i) => {
                const cx = i * slot + slot / 2;
                if (bucket.value === null) {
                  // "No entry", said as a stub on the baseline rather than as
                  // a very small amount of food.
                  return (
                    <Rect
                      key={bucket.from}
                      x={cx - barWidth / 2}
                      y={height - 2}
                      width={barWidth}
                      height={2}
                      fill={theme.border}
                    />
                  );
                }
                const top = y(bucket.value);
                return (
                  <Rect
                    key={bucket.from}
                    x={cx - barWidth / 2}
                    y={top}
                    width={barWidth}
                    height={Math.max(1, height - top)}
                    // Rounded data-end, square at the baseline — the radius is
                    // clamped so a short bar does not turn into a lozenge.
                    rx={Math.min(4, barWidth / 2, Math.max(0, (height - top) / 2))}
                    fill={color}
                  />
                );
              })}

              {target != null ? (
                <Line
                  x1={0}
                  x2={plotWidth}
                  y1={y(target)}
                  y2={y(target)}
                  stroke={theme.textDim}
                  strokeWidth={1}
                  // Dashed here and nowhere else: this one really is a
                  // threshold, which is exactly what a dashed rule means.
                  strokeDasharray="4 4"
                />
              ) : null}
            </Svg>
          </Svg>
        ) : null}

        {width > 0
          ? axis.ticks.map((tick) => (
              <Text
                key={tick}
                style={[styles.yLabel, { top: y(tick) - 7 }]}
                numberOfLines={1}
              >
                {formatValue(tick)}
              </Text>
            ))
          : null}

        {width > 0 && target != null ? (
          <Text style={[styles.targetLabel, { top: y(target) - 15 }]}>
            Target {formatValue(target)}
          </Text>
        ) : null}
      </View>

      <View style={styles.xAxis}>
        <Text style={styles.xLabel}>{shortDay(buckets[0]!.from)}</Text>
        <Text style={styles.xLabel}>
          {shortDay(buckets[buckets.length - 1]!.to)}
        </Text>
      </View>
    </View>
  );
}

const onWidth = (set: (w: number) => void) => (event: LayoutChangeEvent) =>
  set(Math.round(event.nativeEvent.layout.width));

/** Whole days between two YYYY-MM-DD keys. */
function dayDiff(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function shortDay(key: string): string {
  const [, month, day] = key.split('-');
  const index = Number(month) - 1;
  return `${Number(day)} ${MONTHS[index] ?? ''}`.trim();
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    frame: {
      marginTop: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: { color: theme.textDim, fontSize: 13 },
    yLabel: {
      position: 'absolute',
      left: 0,
      width: Y_LABEL_WIDTH - 6,
      textAlign: 'right',
      color: theme.textDim,
      fontSize: 11,
      // Axis ticks are a column of numbers, so they align on equal-width
      // digits. Hero values elsewhere deliberately do not.
      fontVariant: ['tabular-nums'],
    },
    targetLabel: {
      position: 'absolute',
      right: 0,
      color: theme.textDim,
      fontSize: 11,
    },
    xAxis: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginLeft: Y_LABEL_WIDTH,
      marginTop: 2,
    },
    xLabel: { color: theme.textDim, fontSize: 11 },
    legend: {
      color: theme.textDim,
      fontSize: 11,
      marginLeft: Y_LABEL_WIDTH,
      marginTop: 2,
    },
  });
