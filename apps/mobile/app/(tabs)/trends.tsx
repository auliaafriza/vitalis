import {
  fillDays,
  formatDuration,
  formatShortDay,
  lastNDays,
  linearTrend,
  todayKey,
} from '@calorya/core';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, StatTile } from '../../src/components/ui';
import { useDaySummaries, useProfile, useTargets } from '../../src/lib/hooks';
import { radius, spacing, theme } from '../../src/lib/theme';

const RANGES = [7, 30, 90] as const;

export default function TrendsScreen() {
  const { data: profile } = useProfile();
  const timezone =
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jakarta';
  const today = todayKey(timezone);

  const [range, setRange] = useState<number>(30);
  const days = useMemo(() => lastNDays(range, today), [range, today]);
  const { data: summaries } = useDaySummaries(days[0] ?? today, today);
  const { data: targets } = useTargets(today);

  const series = useMemo(() => fillDays(summaries ?? [], days), [summaries, days]);

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
      water: Math.round(mean(series.map((s) => s.waterMl))),
      sleep: Math.round(mean(withSleep.map((s) => s.sleepMin ?? 0))),
      loggedDays: withFood.length,
      weightTrend: linearTrend(weightPoints),
    };
  }, [series]);

  /**
   * A bar chart drawn with plain Views.
   *
   * Pulling in a charting library for four sparklines would add a native
   * dependency and a build step; flex-sized bars give the same information at
   * a fraction of the weight.
   */
  const maxKcal = Math.max(targets?.kcal ?? 2000, ...series.map((s) => s.kcal), 1);
  const visible = series.slice(-14);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.rangeRow}>
        {RANGES.map((option) => (
          <Pressable
            key={option}
            onPress={() => setRange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: range === option }}
            style={[styles.rangeChip, range === option && styles.rangeChipActive]}
          >
            <Text
              style={[styles.rangeText, range === option && styles.rangeTextActive]}
            >
              {option} hari
            </Text>
          </Pressable>
        ))}
      </View>

      {stats.loggedDays === 0 ? (
        <EmptyState
          title="Belum ada data untuk digrafikkan"
          description="Catat makanan dan kebiasaan harianmu beberapa hari, lalu tren akan muncul di sini."
        />
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile
              label="Rata-rata kalori"
              value={stats.kcal.toLocaleString('id-ID')}
              unit="kkal"
              hint={`${stats.loggedDays} hari tercatat`}
              accent={theme.food}
            />
            <StatTile
              label="Rata-rata protein"
              value={String(stats.protein)}
              unit="g"
              accent={theme.body}
            />
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

          {stats.weightTrend ? (
            <Card>
              <Text style={styles.cardTitle}>Tren berat badan</Text>
              <Text
                style={[
                  styles.trendValue,
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
                {stats.weightTrend.slopePerWeek > 0 ? '+' : ''}
                {stats.weightTrend.slopePerWeek} kg / minggu
              </Text>
              <Text style={styles.cardMeta}>
                Berdasarkan {stats.weightTrend.sampleSize} penimbangan (regresi linier)
              </Text>
            </Card>
          ) : null}

          <Card>
            <Text style={styles.cardTitle}>Kalori 14 hari terakhir</Text>
            <View style={styles.chart}>
              {visible.map((point) => (
                <View key={point.loggedOn} style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(2, (point.kcal / maxKcal) * 100)}%`,
                        backgroundColor:
                          targets && point.kcal > targets.kcal ? theme.body : theme.food,
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.chartLabels}>
              <Text style={styles.cardMeta}>
                {formatShortDay(visible[0]?.loggedOn ?? today)}
              </Text>
              <Text style={styles.cardMeta}>
                {formatShortDay(visible[visible.length - 1]?.loggedOn ?? today)}
              </Text>
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  rangeRow: { flexDirection: 'row', gap: spacing.sm },
  rangeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rangeChipActive: { backgroundColor: theme.surfaceAlt, borderColor: theme.brandDim },
  rangeText: { color: theme.textDim, fontSize: 13 },
  rangeTextActive: { color: theme.text, fontWeight: '600' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cardTitle: { color: theme.textMuted, fontSize: 13, fontWeight: '600' },
  cardMeta: { color: theme.textDim, fontSize: 11, marginTop: 4 },
  trendValue: { fontSize: 22, fontWeight: '700', marginTop: spacing.sm },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 3,
    marginTop: spacing.md,
  },
  barColumn: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between' },
});
