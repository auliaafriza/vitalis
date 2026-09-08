import {
  clampRange,
  fillDays,
  formatDuration,
  formatShortDay,
  isRangeAllowed,
  lastNDays,
  linearTrend,
  todayKey,
  TREND_RANGES,
} from '@calorya/core';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { LockIcon } from '../../src/components/icons';
import { Card, EmptyState, Segmented, StatTile } from '../../src/components/ui';
import {
  useAllDaySummaries,
  useDaySummaries,
  useProfile,
  useTargets,
  useTier,
} from '../../src/lib/hooks';
import {
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '../../src/lib/theme';

const VIEWS = [
  { value: 'kalori', label: 'Kalori' },
  { value: 'berat', label: 'Berat Badan' },
  { value: 'nutrisi', label: 'Nutrisi' },
] as const;

type ViewKey = (typeof VIEWS)[number]['value'];

export default function TrendsScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { data: profile } = useProfile();
  const timezone =
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jakarta';
  const today = todayKey(timezone);

  const { data: tier } = useTier();
  const [view, setView] = useState<ViewKey>('kalori');
  const [requested, setRequested] = useState<number | null>(7);
  const [upsell, setUpsell] = useState<string | null>(null);

  /**
   * Clamped rather than merely validated, so a lapsed subscription drops the
   * chart back to the free window instead of leaving it empty.
   */
  const range = clampRange(tier, requested);
  const allHistory = range === null;

  const days = useMemo(
    () => (allHistory ? [] : lastNDays(range ?? 7, today)),
    [allHistory, range, today],
  );

  const windowed = useDaySummaries(days[0] ?? today, today);
  const everything = useAllDaySummaries(allHistory);
  const summaries = allHistory ? everything.data : windowed.data;

  const { data: targets } = useTargets(today);

  // With all history the axis is whatever exists, not a fixed-length window.
  const axis = useMemo(
    () => (allHistory ? (summaries ?? []).map((s) => s.loggedOn) : days),
    [allHistory, summaries, days],
  );

  const series = useMemo(() => fillDays(summaries ?? [], axis), [summaries, axis]);

  const stats = useMemo(() => {
    const withFood = series.filter((s) => s.kcal > 0);
    const withSleep = series.filter((s) => s.sleepMin !== null);
    const mean = (values: number[]) =>
      values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

    const weightPoints = series
      .filter((s) => s.weightKg !== null)
      .map((s) => ({ day: s.loggedOn, value: s.weightKg as number }));

    return {
      kcal: Math.round(mean(withFood.map((s) => s.kcal))),
      protein: Math.round(mean(withFood.map((s) => s.proteinG))),
      carbs: Math.round(mean(withFood.map((s) => s.carbsG))),
      fat: Math.round(mean(withFood.map((s) => s.fatG))),
      water: Math.round(mean(series.map((s) => s.waterMl))),
      sleep: Math.round(mean(withSleep.map((s) => s.sleepMin ?? 0))),
      loggedDays: withFood.length,
      weightPoints,
      weightTrend: linearTrend(weightPoints),
    };
  }, [series]);

  const visible = series.slice(-14);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Progress</Text>
        <Text style={styles.subtitle}>Pantau perkembanganmu dari waktu ke waktu.</Text>

        <Segmented options={VIEWS} value={view} onChange={setView} />

        {/*
          Locked ranges stay visible. Hiding them would make the free plan look
          complete and premium invisible; a padlock that explains itself when
          tapped is both more honest and more persuasive.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rangeRow}
        >
          {TREND_RANGES.map((option) => {
            const allowed = isRangeAllowed(tier, option.days);
            const active = allowed && range === option.days;

            return (
              <Pressable
                key={option.days === null ? 'all' : option.days}
                onPress={() => {
                  if (allowed) {
                    setRequested(option.days);
                    setUpsell(null);
                  } else {
                    setUpsell(option.label);
                  }
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: !allowed }}
                style={[styles.rangeChip, active && styles.rangeChipActive]}
              >
                {!allowed && <LockIcon color={theme.textDim} size={13} weight={2} />}
                <Text style={[styles.rangeText, active && styles.rangeTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {upsell ? (
          <Card>
            <Text style={styles.upsellTitle}>Tren {upsell.toLowerCase()} — Premium</Text>
            <Text style={styles.upsellBody}>
              Paket gratis menyimpan grafik 7 hari terakhir. Premium membuka 30, 90,
              365 hari, seluruh riwayat, dan ekspor CSV/PDF.
            </Text>
            <Pressable
              onPress={() => setUpsell(null)}
              accessibilityRole="button"
              style={{ alignSelf: 'flex-start', marginTop: spacing.md }}
            >
              <Text style={styles.link}>Nanti saja</Text>
            </Pressable>
          </Card>
        ) : null}

        {stats.loggedDays === 0 ? (
          <EmptyState
            title="Belum ada data untuk digrafikkan"
            description="Catat makanan dan kebiasaan harianmu beberapa hari, lalu tren akan muncul di sini."
          />
        ) : view === 'kalori' ? (
          <>
            <Card>
              <Text style={styles.cardTitle}>Rata-rata Kalori Harian</Text>
              <Text style={styles.big}>
                {stats.kcal.toLocaleString('id-ID')}
                <Text style={styles.bigUnit}> kal</Text>
              </Text>
              <CalorieBars
                days={visible}
                target={targets?.kcal}
                theme={theme}
                styles={styles}
              />
            </Card>

            <View style={styles.tiles}>
              <StatTile
                label="Rata-rata air"
                value={(stats.water / 1000).toFixed(1)}
                unit="L"
                accent={theme.water}
              />
              <StatTile
                label="Rata-rata tidur"
                value={stats.sleep ? formatDuration(stats.sleep) : '—'}
                accent={theme.sleep}
              />
            </View>
          </>
        ) : view === 'berat' ? (
          <Card>
            <Text style={styles.cardTitle}>Berat Badan</Text>
            {stats.weightPoints.length === 0 ? (
              <Text style={styles.upsellBody}>
                Belum ada penimbangan pada rentang ini.
              </Text>
            ) : (
              <>
                <View style={styles.weightHead}>
                  <Text style={styles.big}>
                    {stats.weightPoints[stats.weightPoints.length - 1]!.value.toFixed(1)}
                    <Text style={styles.bigUnit}> kg</Text>
                  </Text>
                  {stats.weightTrend ? (
                    <View
                      style={[
                        styles.deltaChip,
                        {
                          backgroundColor:
                            stats.weightTrend.direction === 'down'
                              ? theme.brandSoft
                              : theme.surfaceAlt,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.deltaText,
                          {
                            color:
                              stats.weightTrend.direction === 'down'
                                ? theme.brand
                                : stats.weightTrend.direction === 'up'
                                  ? theme.move
                                  : theme.textMuted,
                          },
                        ]}
                      >
                        {stats.weightTrend.slopePerWeek > 0 ? '↑' : '↓'}{' '}
                        {Math.abs(stats.weightTrend.slopePerWeek)} kg/minggu
                      </Text>
                    </View>
                  ) : null}
                </View>
                <WeightLine
                  points={stats.weightPoints.map((p) => p.value)}
                  color={theme.brand}
                  styles={styles}
                />
                <View style={styles.axisRow}>
                  <Text style={styles.axisText}>
                    {formatShortDay(stats.weightPoints[0]!.day)}
                  </Text>
                  <Text style={styles.axisText}>
                    {formatShortDay(
                      stats.weightPoints[stats.weightPoints.length - 1]!.day,
                    )}
                  </Text>
                </View>
                {stats.weightTrend ? (
                  <Text style={styles.axisText}>
                    Berdasarkan {stats.weightTrend.sampleSize} penimbangan (regresi
                    linier)
                  </Text>
                ) : null}
              </>
            )}
          </Card>
        ) : (
          <Card>
            <Text style={styles.cardTitle}>Rata-rata Nutrisi Harian</Text>
            <View style={styles.tiles}>
              <StatTile
                label="Protein"
                value={String(stats.protein)}
                unit="g"
                accent={theme.body}
              />
              <StatTile
                label="Karbohidrat"
                value={String(stats.carbs)}
                unit="g"
                accent={theme.move}
              />
              <StatTile
                label="Lemak"
                value={String(stats.fat)}
                unit="g"
                accent={theme.sleep}
              />
              <StatTile
                label="Hari tercatat"
                value={String(stats.loggedDays)}
                accent={theme.food}
              />
            </View>
          </Card>
        )}

        <Card style={{ backgroundColor: theme.brandSoft, borderColor: theme.brandDim }}>
          <Text style={styles.motivation}>
            🌱 Konsistensi hari ini, hasil besar nanti
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * A bar chart drawn with plain Views.
 *
 * Pulling a charting library in for fourteen bars would add weight for no
 * information; the dashed target line is the only thing SVG is used for, and
 * only because a dashed rule cannot be drawn with a View.
 */
function CalorieBars({
  days,
  target,
  theme,
  styles,
}: {
  days: { loggedOn: string; kcal: number }[];
  target?: number;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  const max = Math.max(target ?? 0, ...days.map((d) => d.kcal), 1);

  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={styles.chart}>
        {target ? (
          <View
            style={[styles.targetLine, { bottom: `${(target / max) * 100}%` }]}
            pointerEvents="none"
          >
            <Svg width="100%" height={1}>
              <Line
                x1="0"
                y1="0.5"
                x2="100%"
                y2="0.5"
                stroke={theme.textDim}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            </Svg>
            <Text style={styles.targetLabel}>Target {target.toLocaleString('id-ID')}</Text>
          </View>
        ) : null}

        {days.map((point) => (
          <View key={point.loggedOn} style={styles.barColumn}>
            <View
              style={[
                styles.bar,
                {
                  height: `${Math.max(2, (point.kcal / max) * 100)}%`,
                  backgroundColor:
                    target && point.kcal > target ? theme.body : theme.water,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axisText}>{formatShortDay(days[0]?.loggedOn ?? '')}</Text>
        <Text style={styles.axisText}>
          {formatShortDay(days[days.length - 1]?.loggedOn ?? '')}
        </Text>
      </View>
    </View>
  );
}

/** The weight line. Normalised to its own min/max so small changes stay visible. */
function WeightLine({
  points,
  color,
  styles,
}: {
  points: number[];
  color: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const height = 120;
  const width = 300;

  if (points.length < 2) {
    return (
      <View style={[styles.lineChart, { height }]}>
        <Text style={styles.axisText}>Butuh minimal dua penimbangan.</Text>
      </View>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  // A flat series would divide by zero; 1 kg of headroom keeps the line
  // centred instead of pinning it to the top of the box.
  const span = max - min || 1;

  const coords = points.map((value, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - 10 - ((value - min) / span) * (height - 20);
    return { x, y };
  });

  return (
    <View style={[styles.lineChart, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={3} fill={color} />
        ))}
      </Svg>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.xxl * 2,
    },
    title: { color: theme.text, fontSize: 22, fontWeight: '700' },
    subtitle: { color: theme.textMuted, fontSize: 13, marginTop: -spacing.sm },
    rangeRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
    rangeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    rangeChipActive: { backgroundColor: theme.brandSoft, borderColor: theme.brandDim },
    rangeText: { color: theme.textDim, fontSize: 13 },
    rangeTextActive: { color: theme.brand, fontWeight: '700' },
    cardTitle: { color: theme.textMuted, fontSize: 13, fontWeight: '600' },
    big: { color: theme.text, fontSize: 28, fontWeight: '700', marginTop: 4 },
    bigUnit: { color: theme.textDim, fontSize: 14, fontWeight: '400' },
    weightHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    deltaChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    deltaText: { fontSize: 12, fontWeight: '700' },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 130,
      gap: 4,
    },
    barColumn: { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 4 },
    targetLine: { position: 'absolute', left: 0, right: 0 },
    targetLabel: {
      color: theme.textDim,
      fontSize: 10,
      textAlign: 'right',
      marginTop: 2,
    },
    lineChart: { marginTop: spacing.lg, justifyContent: 'center' },
    axisRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    axisText: { color: theme.textDim, fontSize: 11 },
    tiles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    link: { color: theme.brand, fontSize: 14, fontWeight: '600' },
    upsellTitle: { color: theme.text, fontSize: 14, fontWeight: '700' },
    upsellBody: {
      color: theme.textDim,
      fontSize: 12,
      marginTop: 6,
      lineHeight: 18,
    },
    motivation: { color: theme.brand, fontSize: 13, fontWeight: '600' },
  });
