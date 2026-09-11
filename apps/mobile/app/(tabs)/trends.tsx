import {
  bucketDays,
  clampRange,
  fillDays,
  formatDuration,
  isRangeAllowed,
  lastNDays,
  linearTrend,
  movingAverage,
  todayKey,
  TREND_RANGES,
} from '@calorya/core';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LockIcon } from '../../src/components/icons';
import { BarChart, LineChart } from '../../src/components/charts';
import {
  Card,
  EmptyState,
  Segmented,
  SkeletonCard,
  StatTile,
} from '../../src/components/ui';
import {
  useAllDaySummaries,
  useDaySummaries,
  useProfile,
  useTargets,
  useTier,
  useWeights,
} from '../../src/lib/hooks';
import {
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '../../src/lib/theme';

const VIEWS = [
  { value: 'berat', label: 'Berat & Kalori' },
  { value: 'kalori', label: 'Kalori' },
  { value: 'nutrisi', label: 'Nutrisi' },
] as const;

/**
 * The most columns worth drawing on a phone.
 *
 * A year is 365 days. At 350px of plot that is under a pixel per bar — not a
 * chart, a texture. Beyond this cap the days are averaged into wider buckets
 * (see `bucketDays`), which keeps the shape of the range while leaving marks
 * you can actually see.
 */
const MAX_COLUMNS = 26;

type ViewKey = (typeof VIEWS)[number]['value'];

export default function TrendsScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { data: profile } = useProfile();
  const timezone =
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jakarta';
  const today = todayKey(timezone);

  const { data: tier } = useTier();
  const [view, setView] = useState<ViewKey>('berat');
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
  /*
   * Which of the two queries is actually feeding the chart decides whose
   * loading flag matters — asking the wrong one means the skeleton never
   * appears in "semua riwayat" mode, or never goes away in windowed mode.
   */
  const summariesLoading = allHistory ? everything.isLoading : windowed.isLoading;

  const { data: targets } = useTargets(today);

  /*
   * Weigh-ins, queried directly rather than read off the day summaries.
   *
   * The summaries carry at most one weight per day and no way to tell "did not
   * weigh in" from "weighed the same", which is why the old chart could not
   * space its points by date. This is the query the web app has always used.
   */
  const { data: weights } = useWeights(
    allHistory ? '1900-01-01' : (days[0] ?? today),
    today,
  );

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

    return {
      kcal: Math.round(mean(withFood.map((s) => s.kcal))),
      protein: Math.round(mean(withFood.map((s) => s.proteinG))),
      carbs: Math.round(mean(withFood.map((s) => s.carbsG))),
      fat: Math.round(mean(withFood.map((s) => s.fatG))),
      water: Math.round(mean(series.map((s) => s.waterMl))),
      sleep: Math.round(mean(withSleep.map((s) => s.sleepMin ?? 0))),
      loggedDays: withFood.length,
    };
  }, [series]);

  /*
   * The columns the calorie chart actually draws.
   *
   * This used to be `series.slice(-14)` — a hard-coded fortnight — so choosing
   * "90 hari" or "1 tahun" changed the averages above the chart and left the
   * chart itself showing the same two weeks. The range selector looked like it
   * worked and did not. Now the whole selected range is drawn, bucketed down
   * to something a phone can render.
   */
  const calorieColumns = useMemo(
    () =>
      bucketDays(
        series.map((s) => ({ day: s.loggedOn, value: s.kcal > 0 ? s.kcal : null })),
        MAX_COLUMNS,
      ),
    [series],
  );

  /**
   * Weight, as measured and as smoothed.
   *
   * Daily bodyweight swings a kilo or more on water and gut contents, so the
   * raw points alone read as noise and panic. The 7-day average is the line to
   * actually judge progress by; the raw points stay visible underneath so the
   * smoothing is never hiding anything.
   */
  const weightChart = useMemo(() => {
    const byDay = new Map((weights ?? []).map((w) => [w.loggedOn, w.weightKg]));
    const raw = axis.map((day) => ({ day, value: byDay.get(day) ?? null }));

    const measured = raw.filter((p) => p.value !== null);
    const firstDay = measured[0]?.day ?? null;
    const lastDay = measured[measured.length - 1]?.day ?? null;

    const averaged = movingAverage(
      raw.map((p) => p.value),
      7,
    );

    /*
     * The smoothed line stops where the measurements stop.
     *
     * A centred 7-day average produces a value for any day with a weigh-in
     * within three days either side — including days *after* the last one. On
     * a 7-day range that drew a confident pale line all the way to today from
     * a scale that had not been stepped on since Tuesday. A chart may not
     * extrapolate; outside the measured span it has nothing to say.
     */
    const smoothed = raw.map((p, i) => ({
      day: p.day,
      value:
        firstDay !== null && lastDay !== null && p.day >= firstDay && p.day <= lastDay
          ? (averaged[i] ?? null)
          : null,
    }));

    return {
      raw,
      smoothed,
      /*
       * Smoothing only earns its place over a span long enough for a 7-day
       * window to mean something. Over one week it is nearly a straight line
       * through five points — not a trend, just a second thing to explain.
       */
      showSmoothed: measured.length >= 10 && axis.length >= 21,
      points: measured.map((p) => ({ day: p.day, value: p.value as number })),
    };
  }, [weights, axis]);

  const weightTrend = useMemo(
    () => linearTrend(weightChart.points),
    [weightChart.points],
  );
  const weightNow =
    weightChart.points.length > 0
      ? weightChart.points[weightChart.points.length - 1]!.value
      : null;


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

        {summariesLoading ? (
          /*
           * Not the empty state.
           *
           * `stats.loggedDays` is computed from `summaries ?? []`, so before
           * the query answers it is 0 — and the screen told everyone, on every
           * visit, that they had never logged anything. For a returning user
           * that is the most alarming sentence the app can show.
           */
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={5} />
            <SkeletonCard lines={3} />
          </>
        ) : stats.loggedDays === 0 ? (
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
              <BarChart
                buckets={calorieColumns}
                color={theme.water}
                target={targets?.kcal ?? null}
                formatValue={(v) => v.toLocaleString('id-ID')}
              />
              {calorieColumns.length < series.length ? (
                <Text style={styles.axisText}>
                  Tiap batang merata-ratakan{' '}
                  {Math.ceil(series.length / calorieColumns.length)} hari.
                </Text>
              ) : null}
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
          /*
           * Two panels, stacked, over the same dates — never one plot with a
           * kilogram axis on the left and a calorie axis on the right. A
           * dual-axis chart lets the arbitrary alignment of the two scales
           * invent a correlation the data does not contain, which for someone
           * judging whether their eating is working is the worst possible
           * thing for a chart to do. Sharing the x-axis lets the reader line
           * the two up themselves, and the comparison stays theirs.
           */
          <>
            <Card>
              <View style={styles.weightHead}>
                <View>
                  <Text style={styles.cardTitle}>Berat Badan</Text>
                  {weightNow !== null ? (
                    <Text style={styles.big}>
                      {weightNow.toFixed(1)}
                      <Text style={styles.bigUnit}> kg</Text>
                    </Text>
                  ) : null}
                </View>
                {weightTrend ? (
                  <View
                    style={[
                      styles.deltaChip,
                      {
                        backgroundColor:
                          weightTrend.direction === 'flat'
                            ? theme.surfaceAlt
                            : theme.brandSoft,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.deltaText,
                        {
                          color:
                            weightTrend.direction === 'flat'
                              ? theme.textMuted
                              : theme.brand,
                        },
                      ]}
                    >
                      {weightTrend.direction === 'flat'
                        ? 'Stabil'
                        : `${weightTrend.slopePerWeek > 0 ? '↑' : '↓'} ${Math.abs(
                            weightTrend.slopePerWeek,
                          ).toFixed(2)} kg/minggu`}
                    </Text>
                  </View>
                ) : null}
              </View>

              <LineChart
                points={weightChart.raw}
                overlay={weightChart.showSmoothed ? weightChart.smoothed : undefined}
                overlayLabel={
                  weightChart.showSmoothed ? 'Garis tebal = rata-rata 7 hari' : undefined
                }
                color={theme.brand}
                formatValue={(v) => v.toFixed(1)}
              />

              {weightChart.points.length === 0 ? (
                <Text style={styles.axisText}>
                  Belum ada penimbangan pada rentang ini. Catat beratmu di layar
                  Kesehatan, lalu grafiknya muncul di sini.
                </Text>
              ) : weightTrend ? (
                <Text style={styles.axisText}>
                  Dari {weightTrend.sampleSize} penimbangan (regresi linier).
                </Text>
              ) : (
                <Text style={styles.axisText}>
                  Butuh minimal dua penimbangan untuk menghitung arah tren.
                </Text>
              )}
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Kalori pada rentang yang sama</Text>
              <Text style={styles.axisText}>
                Rata-rata {stats.kcal.toLocaleString('id-ID')} kal/hari
                {targets ? ` dari target ${targets.kcal.toLocaleString('id-ID')}` : ''}
              </Text>
              <BarChart
                buckets={calorieColumns}
                color={theme.water}
                target={targets?.kcal ?? null}
                formatValue={(v) => v.toLocaleString('id-ID')}
              />
              <Text style={styles.axisText}>
                {calorieColumns.length < series.length
                  ? `Garis putus-putus adalah targetmu. Tiap batang merata-ratakan ${Math.ceil(
                      series.length / calorieColumns.length,
                    )} hari.`
                  : 'Garis putus-putus adalah targetmu.'}
              </Text>
            </Card>
          </>
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

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.xxl * 2,
    },
    title: { color: theme.text, fontSize: 24, fontWeight: '700' },
    subtitle: { color: theme.textMuted, fontSize: 14, marginTop: -spacing.sm },
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
    rangeText: { color: theme.textDim, fontSize: 14 },
    rangeTextActive: { color: theme.brand, fontWeight: '700' },
    cardTitle: { color: theme.textMuted, fontSize: 14, fontWeight: '600' },
    big: { color: theme.text, fontSize: 30, fontWeight: '700', marginTop: 4 },
    bigUnit: { color: theme.textDim, fontSize: 15, fontWeight: '400' },
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
    deltaText: { fontSize: 13, fontWeight: '700' },
    axisText: { color: theme.textDim, fontSize: 12 },
    tiles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    link: { color: theme.brand, fontSize: 15, fontWeight: '600' },
    upsellTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
    upsellBody: {
      color: theme.textDim,
      fontSize: 13,
      marginTop: 6,
      lineHeight: 18,
    },
    motivation: { color: theme.brand, fontSize: 14, fontWeight: '600' },
  });
