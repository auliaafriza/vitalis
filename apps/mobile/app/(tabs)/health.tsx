import {
  bmi,
  bmiCategory,
  BMI_LABEL,
  formatDuration,
  formatVolume,
  minutesBetween,
  todayKey,
} from '@calorya/core';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MoonIcon, PhoneIcon, SunIcon } from '../../src/components/icons';
import { privacyUrl } from '../../src/lib/site';
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
import { radius, spacing, useTheme, useThemedStyles, type Theme } from '../../src/lib/theme';

const QUICK_WATER = [150, 250, 350, 500] as const;

export default function HealthScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
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
      <Card>
        <Text style={styles.title}>Tampilan</Text>
        <ThemePicker />
      </Card>

      <Card>
        <Text style={styles.title}>Privasi</Text>
        <Text style={styles.meta}>
          Catatanmu hanya bisa dibaca oleh akunmu. Tidak ada iklan dan tidak ada
          pelacak di aplikasi ini.
        </Text>
        {privacyUrl() ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(privacyUrl()!)}
            style={{ marginTop: spacing.md }}
          >
            <Text style={styles.privacyLink}>Baca kebijakan privasi</Text>
          </Pressable>
        ) : null}
      </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Light, dark, or whatever the device says.
 *
 * "Ikuti perangkat" is a real third option rather than a resolved value: a
 * phone that switches at sunset should keep switching, and collapsing that
 * into whichever theme is active right now would quietly stop it.
 */
function ThemePicker() {
  const { choice, setChoice, theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const options = [
    { value: 'light' as const, label: 'Terang', Icon: SunIcon },
    { value: 'dark' as const, label: 'Gelap', Icon: MoonIcon },
    { value: 'system' as const, label: 'Perangkat', Icon: PhoneIcon },
  ];

  return (
    <View style={styles.themeRow} accessibilityRole="radiogroup">
      {options.map((option) => {
        const active = choice === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => setChoice(option.value)}
            style={[styles.themeOption, active && styles.themeOptionActive]}
          >
            <option.Icon
              color={active ? theme.brand : theme.textDim}
              size={18}
              weight={1.9}
            />
            <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
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
    privacyLink: { color: theme.brand, fontSize: 14, fontWeight: '600' },
    themeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    themeOption: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    themeOptionActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    themeLabel: { color: theme.textDim, fontSize: 11, fontWeight: '600' },
    themeLabelActive: { color: theme.brand },
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
