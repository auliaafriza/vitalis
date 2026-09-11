import {
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
} from "@calorya/core";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  PlusIcon,
} from "../../src/components/icons";
import {
  Button,
  Card,
  ErrorNote,
  MacroBar,
  Ring,
  Skeleton,
  SkeletonCard,
  StatTile,
} from "../../src/components/ui";
import { DayNav } from "../../src/components/day-nav";
import { WaterQuickAdd } from "../../src/components/water-quick-add";
import {
  useDaySummaries,
  useDaySummary,
  useFoodEntries,
  useProfile,
  useTargets,
} from "../../src/lib/hooks";
import {
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from "../../src/lib/theme";
import { usePedometer } from "../../src/lib/use-pedometer";

const MEAL_ORDER: readonly MealType[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

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
    "Asia/Jakarta";
  const today = todayKey(timezone);

  // The header steps through days. Forward is capped at today: there is
  // nothing to show for tomorrow, and an empty ring reads as a bug.
  const [day, setDay] = useState(today);

  const { data: targets, isLoading: targetsLoading } = useTargets(day);
  const {
    data: summary,
    error,
    refetch,
    isRefetching,
    isLoading: summaryLoading,
  } = useDaySummary(day);
  const { data: entries } = useFoodEntries(day);

  /*
   * The first load for this day, as opposed to a background refresh.
   *
   * react-query's `isLoading` is only true when there is no data yet, which is
   * exactly the case where showing the layout would be lying: `EMPTY_DAY`
   * below fills every number with 0 and the calorie target with a made-up
   * 2000, so an un-answered query renders a confident dashboard saying you
   * have eaten nothing and your goal is a number nobody chose. A refetch keeps
   * the real numbers on screen and shows the pull-to-refresh spinner instead.
   */
  const firstLoad = targetsLoading || summaryLoading;

  const days = useMemo(() => lastNDays(30, today), [today]);
  const { data: recent } = useDaySummaries(days[0] ?? today, today);

  // The one thing the web version cannot do: read the device pedometer.
  const pedometer = usePedometer(timezone);

  const streak = useMemo(
    () =>
      currentStreak(
        (recent ?? []).map((s) => s.loggedOn),
        today,
      ),
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
    return MEAL_ORDER.map((meal) => ({
      meal,
      kcal: totals.get(meal) ?? 0,
    })).filter((row) => row.kcal > 0);
  }, [entries]);

  if (error) {
    return (
      <SafeAreaView edges={["top"]} style={styles.screen}>
        <View style={{ padding: spacing.lg }}>
          <ErrorNote error={error} />
        </View>
      </SafeAreaView>
    );
  }

  if (firstLoad) {
    return (
      <SafeAreaView edges={["top"]} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Skeleton height={13} width="35%" />
              <Skeleton height={22} width="55%" />
            </View>
          </View>

          {/* The ring card, in outline: day nav, the ring itself, macros. */}
          <Card>
            <Skeleton height={18} width="50%" style={{ alignSelf: "center" }} />
            <View style={styles.ringWrap}>
              <Skeleton height={182} width={182} radius={91} />
            </View>
            <Skeleton
              height={14}
              width="60%"
              style={{ alignSelf: "center", marginBottom: spacing.lg }}
            />
            {/*
              `styles.macros` is a row, and the three real MacroBars each take
              a third of it. Each skeleton needs its own flex box for that —
              a bare width:"100%" child in a row overflows the card instead of
              sharing it.
            */}
            <View style={styles.macros}>
              <View style={{ flex: 1 }}>
                <Skeleton height={12} />
              </View>
              <View style={{ flex: 1 }}>
                <Skeleton height={12} />
              </View>
              <View style={{ flex: 1 }}>
                <Skeleton height={12} />
              </View>
            </View>
          </Card>

          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
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
              Halo
              {profile?.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}
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
          <DayNav selected={day} today={today} onChange={setDay} />

          <View style={styles.ringWrap}>
            <Ring
              progress={current.kcal / targetKcal}
              color={theme.food}
              size={182}
            >
              <Text style={styles.ringValue}>
                {Math.round(current.kcal).toLocaleString("id-ID")}
              </Text>
              <Text style={styles.ringTarget}>
                dari {targetKcal.toLocaleString("id-ID")} kal
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
            onPress={() => router.push(`/nutrition?add=1&day=${day}`)}
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
                <View
                  style={[styles.mealDot, { backgroundColor: theme.brandSoft }]}
                >
                  <Text style={styles.mealEmoji}>{MEAL_EMOJI[row.meal]}</Text>
                </View>
                <Text style={styles.mealName}>{MEAL_LABEL[row.meal]}</Text>
                <Text style={styles.mealKcal}>{Math.round(row.kcal)} kal</Text>
              </View>
            ))
          )}
        </Card>

        {/*
          The four tiles are the read-only face of the health screen, so
          tapping one opens the place where that number is edited. That is a
          shorter path than a tab, and it is where people already look.
        */}
        <View style={styles.tiles}>
          <StatTile
            onPress={() => router.push("/health")}
            label="Air"
            value={formatVolume(current.waterMl)}
            hint={
              targets ? `Target ${formatVolume(targets.waterMl)}` : undefined
            }
            accent={theme.water}
          />
          <StatTile
            onPress={() => router.push("/health")}
            label="Tidur"
            value={
              current.sleepMin === null ? "—" : formatDuration(current.sleepMin)
            }
            hint={
              targets ? `Target ${formatDuration(targets.sleepMin)}` : undefined
            }
            accent={theme.sleep}
          />
          <StatTile
            onPress={() => router.push("/health")}
            label="Langkah"
            value={steps === null ? "—" : steps.toLocaleString("id-ID")}
            /*
             * The old hint had no branch for "working". It read: sensor
             * missing → "Sensor tidak tersedia", otherwise → "Error dari
             * sensor perangkat" — so a perfectly healthy pedometer was
             * labelled an error, permanently, on every device that had one.
             * That is the word people were seeing.
             */
            hint={
              pedometer.available === false
                ? "Sensor tidak tersedia"
                : pedometer.error
                  ? pedometer.error
                  : day !== today
                    ? "Tercatat hari itu"
                    : pedometer.limited
                      ? "Dihitung selama aplikasi dibuka"
                      : "Dari sensor perangkat"
            }
            accent={theme.move}
          />
          <StatTile
            onPress={() => router.push("/health")}
            label="Berat"
            value={current.weightKg ? formatWeight(current.weightKg) : "—"}
            hint="Ditimbang hari ini"
            accent={theme.body}
          />
        </View>

        <Card>
          <Text style={styles.cardTitle}>Air Minum</Text>
          <WaterQuickAdd day={day} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: "🥣",
  lunch: "🍱",
  dinner: "🍲",
  snack: "🍎",
};

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.xxl * 2,
    },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    greeting: { color: theme.textDim, fontSize: 14 },
    title: { color: theme.text, fontSize: 24, fontWeight: "700" },
    streak: {
      backgroundColor: theme.brandSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    streakText: { color: theme.brand, fontWeight: "700", fontSize: 13 },
    ringWrap: { alignItems: "center", marginVertical: spacing.lg },
    ringValue: { color: theme.text, fontSize: 36, fontWeight: "700" },
    ringTarget: { color: theme.textDim, fontSize: 13, marginTop: 2 },
    remaining: {
      color: theme.textMuted,
      fontSize: 14,
      textAlign: "center",
      marginBottom: spacing.lg,
    },
    macros: { flexDirection: "row", gap: spacing.md },
    cardTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "700",
      marginBottom: spacing.md,
    },
    mealRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: 10,
    },
    mealDot: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    mealEmoji: { fontSize: 18 },
    mealName: { flex: 1, color: theme.text, fontSize: 15, fontWeight: "600" },
    mealKcal: { color: theme.textMuted, fontSize: 14, fontWeight: "600" },
    mealEmpty: { color: theme.textDim, fontSize: 14 },
    tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  });
