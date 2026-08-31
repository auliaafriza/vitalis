import {
  currentStreak,
  dayScore,
  formatDuration,
  formatKcal,
  formatVolume,
  formatWeight,
  lastNDays,
  relativeDayLabel,
  todayKey,
  type DaySummary,
} from '@vitalis/core';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorNote, ProgressBar, StatTile } from '../../src/components/ui';
import {
  useAddWater,
  useDaySummaries,
  useDaySummary,
  useProfile,
  useTargets,
} from '../../src/lib/hooks';
import { spacing, theme } from '../../src/lib/theme';
import { usePedometer } from '../../src/lib/use-pedometer';

const QUICK_WATER = [200, 350, 500] as const;

const EMPTY_DAY = (day: string): DaySummary => ({
  loggedOn: day,
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  waterMl: 0,
  sleepMin: null,
  steps: null,
  moodAvg: null,
  weightKg: null,
});

export default function DashboardScreen() {
  const { data: profile } = useProfile();
  const timezone =
    profile?.timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    'Asia/Jakarta';
  const day = todayKey(timezone);

  const { data: targets } = useTargets(day);
  const { data: summary, error, refetch, isRefetching } = useDaySummary(day);

  const days = useMemo(() => lastNDays(30, day), [day]);
  const { data: recent } = useDaySummaries(days[0] ?? day, day);
  const addWater = useAddWater(day);

  // The one thing the web version cannot do: read the device pedometer.
  const pedometer = usePedometer(timezone);

  const streak = useMemo(
    () => currentStreak((recent ?? []).map((s) => s.loggedOn), day),
    [recent, day],
  );

  const today = summary ?? EMPTY_DAY(day);
  const score = targets ? dayScore(today, targets) : null;
  const remaining = targets ? targets.kcal - today.kcal : 0;
  const steps = today.steps ?? pedometer.steps;

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorNote error={error} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={theme.brand}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Halo{profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}
          </Text>
          <Text style={styles.date}>{relativeDayLabel(day, day)}</Text>
        </View>
        {streak > 0 ? <Text style={styles.streak}>🔥 {streak} hari</Text> : null}
      </View>

      <Card>
        <View style={styles.kcalRow}>
          <Text style={styles.kcalValue}>{Math.round(today.kcal)}</Text>
          <Text style={styles.kcalTarget}>/ {targets?.kcal ?? '—'} kkal</Text>
        </View>

        <ProgressBar
          value={today.kcal}
          max={targets?.kcal ?? 2000}
          color={theme.food}
          label="Kalori harian"
        />

        <Text style={styles.remaining}>
          {remaining >= 0
            ? `Sisa ${formatKcal(remaining)} untuk hari ini`
            : `Lewat ${formatKcal(-remaining)} dari target`}
        </Text>

        <View style={styles.macros}>
          <Macro
            label="Protein"
            value={today.proteinG}
            max={targets?.proteinG ?? 0}
            color={theme.body}
          />
          <Macro
            label="Karbo"
            value={today.carbsG}
            max={targets?.carbsG ?? 0}
            color={theme.move}
          />
          <Macro
            label="Lemak"
            value={today.fatG}
            max={targets?.fatG ?? 0}
            color={theme.sleep}
          />
        </View>
      </Card>

      {score ? (
        <Text style={styles.score}>Skor hari ini {score.total}/100</Text>
      ) : null}

      <View style={styles.tiles}>
        <StatTile
          label="Air"
          value={formatVolume(today.waterMl)}
          hint={targets ? `Target ${formatVolume(targets.waterMl)}` : undefined}
          accent={theme.water}
        />
        <StatTile
          label="Tidur"
          value={today.sleepMin === null ? '—' : formatDuration(today.sleepMin)}
          hint={targets ? `Target ${formatDuration(targets.sleepMin)}` : undefined}
          accent={theme.sleep}
        />
        <StatTile
          label="Langkah"
          value={steps === null ? '—' : steps.toLocaleString('id-ID')}
          hint={
            pedometer.available === false
              ? 'Sensor tidak tersedia'
              : pedometer.error ?? 'Dari sensor perangkat'
          }
          accent={theme.move}
        />
        <StatTile
          label="Berat"
          value={today.weightKg ? formatWeight(today.weightKg) : '—'}
          hint="Ditimbang hari ini"
          accent={theme.body}
        />
      </View>

      <Card>
        <Text style={styles.quickTitle}>Tambah air cepat</Text>
        <View style={styles.quickRow}>
          {QUICK_WATER.map((ml) => (
            <Button
              key={ml}
              label={`+${ml} ml`}
              variant="ghost"
              disabled={addWater.isPending}
              onPress={() => addWater.mutate({ loggedOn: day, amountMl: ml })}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

function Macro({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={styles.macroLabel}>
        {label} {Math.round(value)}/{max} g
      </Text>
      <ProgressBar value={value} max={max} color={color} label={`${label} harian`} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { color: theme.textDim, fontSize: 13 },
  date: { color: theme.text, fontSize: 20, fontWeight: '700' },
  streak: { color: theme.move, fontWeight: '600' },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: spacing.md },
  kcalValue: { color: theme.text, fontSize: 32, fontWeight: '700' },
  kcalTarget: { color: theme.textDim, fontSize: 14 },
  remaining: { color: theme.textMuted, fontSize: 13, marginTop: spacing.sm },
  macros: { gap: spacing.sm, marginTop: spacing.md },
  macroLabel: { color: theme.textDim, fontSize: 12 },
  score: { color: theme.brand, fontSize: 13, fontWeight: '600' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickTitle: { color: theme.textMuted, fontSize: 13, marginBottom: spacing.md },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
});
