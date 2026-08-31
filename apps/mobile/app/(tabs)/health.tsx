import {
  bmi,
  bmiCategory,
  BMI_LABEL,
  formatDuration,
  formatVolume,
  minutesBetween,
  todayKey,
} from '@vitalis/core';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, ErrorNote, ProgressBar } from '../../src/components/ui';
import {
  useAddWater,
  useDaySummary,
  useProfile,
  useSaveSleep,
  useSaveSteps,
  useSaveWeight,
  useTargets,
} from '../../src/lib/hooks';
import { radius, spacing, theme } from '../../src/lib/theme';

const QUICK_WATER = [150, 250, 350, 500] as const;

export default function HealthScreen() {
  const { data: profile } = useProfile();
  const timezone =
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jakarta';
  const day = todayKey(timezone);

  const { data: targets } = useTargets(day);
  const { data: summary } = useDaySummary(day);

  const addWater = useAddWater(day);
  const saveWeight = useSaveWeight(day);
  const saveSleep = useSaveSleep(day);
  const saveSteps = useSaveSteps(day);

  const [weight, setWeight] = useState('');
  const [steps, setSteps] = useState('');
  const [sleepHours, setSleepHours] = useState('7.5');

  const weightValue = Number(weight);
  const showBmi =
    profile?.heightCm && Number.isFinite(weightValue) && weightValue >= 20;
  const bmiValue = showBmi ? bmi(weightValue, profile.heightCm!) : null;

  const waterTotal = summary?.waterMl ?? 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>💧 Air minum</Text>
        <Text style={styles.value}>
          {formatVolume(waterTotal)}
          {targets ? (
            <Text style={styles.meta}> / {formatVolume(targets.waterMl)}</Text>
          ) : null}
        </Text>
        <ProgressBar
          value={waterTotal}
          max={targets?.waterMl ?? 2000}
          color={theme.water}
          label="Progres minum air"
        />
        <View style={styles.row}>
          {QUICK_WATER.map((ml) => (
            <Button
              key={ml}
              label={`+${ml}`}
              variant="ghost"
              disabled={addWater.isPending}
              onPress={() => addWater.mutate({ loggedOn: day, amountMl: ml })}
              style={{ flex: 1 }}
            />
          ))}
        </View>
        {addWater.error != null && <ErrorNote error={addWater.error} />}
      </Card>

      <Card>
        <Text style={styles.title}>🌙 Tidur</Text>
        <Text style={styles.meta}>
          {summary?.sleepMin ? formatDuration(summary.sleepMin) : 'Belum dicatat'}
        </Text>
        <TextInput
          value={sleepHours}
          onChangeText={setSleepHours}
          keyboardType="numeric"
          placeholder="Jam tidur, mis. 7.5"
          placeholderTextColor={theme.textDim}
          style={styles.input}
          accessibilityLabel="Durasi tidur dalam jam"
        />
        <Button
          label="Simpan tidur"
          variant="ghost"
          loading={saveSleep.isPending}
          onPress={() => {
            const hours = Number(sleepHours);
            if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return;
            const wake = new Date();
            const bed = new Date(wake.getTime() - hours * 3_600_000);
            saveSleep.mutate({
              loggedOn: day,
              bedtime: bed.toISOString(),
              wakeAt: wake.toISOString(),
              durationMin: minutesBetween(bed, wake),
            });
          }}
        />
        {saveSleep.error != null && <ErrorNote error={saveSleep.error} />}
      </Card>

      <Card>
        <Text style={styles.title}>👟 Langkah</Text>
        <Text style={styles.meta}>
          {summary?.steps ? summary.steps.toLocaleString('id-ID') : 'Belum dicatat'}
          {targets ? ` / ${targets.steps.toLocaleString('id-ID')}` : ''}
        </Text>
        <ProgressBar
          value={summary?.steps ?? 0}
          max={targets?.steps ?? 8000}
          color={theme.move}
          label="Progres langkah"
        />
        <TextInput
          value={steps}
          onChangeText={setSteps}
          keyboardType="numeric"
          placeholder="Koreksi manual"
          placeholderTextColor={theme.textDim}
          style={styles.input}
          accessibilityLabel="Jumlah langkah"
        />
        <Button
          label="Simpan langkah"
          variant="ghost"
          loading={saveSteps.isPending}
          onPress={() => {
            const n = Number(steps);
            if (!Number.isFinite(n) || n < 0) return;
            saveSteps.mutate({
              loggedOn: day,
              steps: Math.round(n),
              source: 'manual',
            });
            setSteps('');
          }}
        />
      </Card>

      <Card>
        <Text style={styles.title}>⚖️ Berat badan</Text>
        <TextInput
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder="kg"
          placeholderTextColor={theme.textDim}
          style={styles.input}
          accessibilityLabel="Berat badan dalam kilogram"
        />
        {bmiValue !== null ? (
          <Text style={styles.meta}>
            BMI {bmiValue} · {BMI_LABEL[bmiCategory(bmiValue)]} (ambang WHO Asia-Pasifik)
          </Text>
        ) : null}
        <Button
          label="Simpan berat"
          variant="ghost"
          loading={saveWeight.isPending}
          onPress={() => {
            if (!Number.isFinite(weightValue) || weightValue < 20 || weightValue > 400) {
              return;
            }
            saveWeight.mutate({ loggedOn: day, weightKg: weightValue });
            setWeight('');
          }}
        />
        {saveWeight.error != null && <ErrorNote error={saveWeight.error} />}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: theme.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  value: { color: theme.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.sm },
  meta: { color: theme.textDim, fontSize: 13, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  input: {
    backgroundColor: theme.bg,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: theme.text,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
});
