import {
  addDays,
  currentStreak,
  formatDuration,
  formatKcal,
  formatVolume,
  formatWeight,
  lastNDays,
  MEAL_LABEL,
  relativeDayLabel,
  todayKey,
  type DaySummary,
  type MealType,
} from '@calorya/core';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from '../../src/components/icons';
import {
  Button,
  Card,
  ErrorNote,
  MacroBar,
  Ring,
  StatTile,
} from '../../src/components/ui';
import {
  useAddWater,
  useDaySummaries,
  useDaySummary,
  useFoodEntries,
  useProfile,
  useTargets,
} from '../../src/lib/hooks';
import {
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '../../src/lib/theme';
import { usePedometer } from '../../src/lib/use-pedometer';

const QUICK_WATER = [200, 350, 500] as const;
const MEAL_ORDER: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

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
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  const { data: profile } = useProfile();
  const timezone =
    profile?.timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    'Asia/Jakarta';
  const today = todayKey(timezone);

  // The header steps through days. Forward is capped at today: there is
  // nothing to show for tomorrow, and an empty ring reads as a bug.
  const [day, setDay] = useState(today);
  const canGoForward = day < today;

  const { data: targets } = useTargets(day);
  const { data: summary, error, refetch, isRefetching } = useDaySummary(day);
  const { data: entries } = useFoodEntries(day);

  const days = useMemo(() => lastNDays(30, today), [today]);
  const { data: recent } = useDaySummaries(days[0] ?? today, today);
  const addWater = useAddWater(day);

  // The one thing the web version cannot do: read the device pedometer.
  const pedometer = usePedometer(timezone);

  const streak = useMemo(
    () => currentStreak((recent ?? []).map((s) => s.loggedOn), today),
    [recent, today],
  );

  const current = summary ?? EMPTY_DAY(day);
  const targetKcal = targets?.kcal ?? 2000;
  const remaining = targetKcal - current.kcal;
  const steps = current.steps ?? (day === today ? pedometer.steps : null);

  /** Calories per meal, so the day reads as a story rather than one number. */
  const byMeal = useMemo(() => {
    const totals = new Map<MealType, number>();
    for (const entry of entries ?? []) {
      totals.set(entry.meal, (totals.get(entry.meal) ?? 0) + entry.kcal);
    }
    return MEAL_ORDER.map((meal) => ({ meal, kcal: totals.get(meal) ?? 0 })).filter(
      (row) => row.kcal > 0,
    );
  }, [entries]);

  if (error) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <View style={{ padding: spacing.lg }}>
          <ErrorNote error={error} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
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
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              Halo{profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}
            </Text>
            <Text style={styles.title}>{relativeDayLabel(day, today)}</Text>
          </View>
          {streak > 0 ? (
            <View style={styles.streak}>
              <Text style={styles.streakText}>🔥 {streak} hari</Text>
            </View>
          ) : null}
        </View>

        <Card>
          <View style={styles.dayNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hari sebelumnya"
              onPress={() => setDay(addDays(day, -1))}
              hitSlop={10}
            >
              <ChevronLeftIcon color={theme.textDim} size={20} />
            </Pressable>
            <View style={styles.dayNavLabel}>
              <CalendarIcon color={theme.textDim} size={15} weight={1.8} />
              <Text style={styles.dayNavText}>{relativeDayLabel(day, today)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hari berikutnya"
              accessibilityState={{ disabled: !canGoForward }}
              disabled={!canGoForward}
              onPress={() => setDay(addDays(day, 1))}
              hitSlop={10}
            >
              <ChevronRightIcon
                color={canGoForward ? theme.textDim : theme.border}
                size={20}
              />
            </Pressable>
          </View>

          <View style={styles.ringWrap}>
            <Ring progress={current.kcal / targetKcal} color={theme.food} size={182}>
              <Text style={styles.ringValue}>
                {Math.round(current.kcal).toLocaleString('id-ID')}
              </Text>
              <Text style={styles.ringTarget}>
                dari {targetKcal.toLocaleString('id-ID')} kal
              </Text>
            </Ring>
          </View>

          <Text style={styles.remaining}>
            {remaining >= 0
              ? `Sisa ${formatKcal(remaining)} untuk hari ini`
              : `Lewat ${formatKcal(-remaining)} dari target`}
          </Text>

          <View style={styles.macros}>
            <MacroBar
              label="Karbohidrat"
              value={current.carbsG}
              target={targets?.carbsG ?? 0}
              color={theme.move}
            />
            <MacroBar
              label="Protein"
              value={current.proteinG}
              target={targets?.proteinG ?? 0}
              color={theme.body}
            />
            <MacroBar
              label="Lemak"
              value={current.fatG}
              target={targets?.fatG ?? 0}
              color={theme.sleep}
            />
          </View>

          <Button
            label="Catat Makanan"
            onPress={() => router.push('/nutrition?add=1')}
            icon={<PlusIcon color={theme.onBrand} size={18} weight={2.4} />}
            style={{ marginTop: spacing.lg }}
          />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Ringkasan Hari Ini</Text>
          {byMeal.length === 0 ? (
            <Text style={styles.mealEmpty}>
              Belum ada yang dicatat. Mulai dari sarapan?
            </Text>
          ) : (
            byMeal.map((row) => (
              <View key={row.meal} style={styles.mealRow}>
                <View style={[styles.mealDot, { backgroundColor: theme.brandSoft }]}>
                  <Text style={styles.mealEmoji}>{MEAL_EMOJI[row.meal]}</Text>
                </View>
                <Text style={styles.mealName}>{MEAL_LABEL[row.meal]}</Text>
                <Text style={styles.mealKcal}>{Math.round(row.kcal)} kal</Text>
              </View>
            ))
          )}
        </Card>

        <View style={styles.tiles}>
          <StatTile
            label="Air"
            value={formatVolume(current.waterMl)}
            hint={targets ? `Target ${formatVolume(targets.waterMl)}` : undefined}
            accent={theme.water}
          />
          <StatTile
            label="Tidur"
            value={current.sleepMin === null ? '—' : formatDuration(current.sleepMin)}
            hint={targets ? `Target ${formatDuration(targets.sleepMin)}` : undefined}
            accent={theme.sleep}
          />
          <StatTile
            label="Langkah"
            value={steps === null ? '—' : steps.toLocaleString('id-ID')}
            hint={
              pedometer.available === false
                ? 'Sensor tidak tersedia'
                : (pedometer.error ?? 'Dari sensor perangkat')
            }
            accent={theme.move}
          />
          <StatTile
            label="Berat"
            value={current.weightKg ? formatWeight(current.weightKg) : '—'}
            hint="Ditimbang hari ini"
            accent={theme.body}
          />
        </View>

        <Card>
          <Text style={styles.cardTitle}>Tambah air cepat</Text>
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
    </SafeAreaView>
  );
}

const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🥣',
  lunch: '🍱',
  dinner: '🍲',
  snack: '🍎',
};

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.xxl * 2,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    greeting: { color: theme.textDim, fontSize: 13 },
    title: { color: theme.text, fontSize: 22, fontWeight: '700' },
    streak: {
      backgroundColor: theme.brandSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    streakText: { color: theme.brand, fontWeight: '700', fontSize: 12 },
    dayNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dayNavLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dayNavText: { color: theme.textMuted, fontSize: 13, fontWeight: '600' },
    ringWrap: { alignItems: 'center', marginVertical: spacing.lg },
    ringValue: { color: theme.text, fontSize: 34, fontWeight: '700' },
    ringTarget: { color: theme.textDim, fontSize: 12, marginTop: 2 },
    remaining: {
      color: theme.textMuted,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    macros: { flexDirection: 'row', gap: spacing.md },
    cardTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: spacing.md,
    },
    mealRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 10,
    },
    mealDot: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mealEmoji: { fontSize: 17 },
    mealName: { flex: 1, color: theme.text, fontSize: 14, fontWeight: '600' },
    mealKcal: { color: theme.textMuted, fontSize: 13, fontWeight: '600' },
    mealEmpty: { color: theme.textDim, fontSize: 13 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    quickRow: { flexDirection: 'row', gap: spacing.sm },
  });
