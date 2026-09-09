import {
  saveTargets,
  setTutorialSeen,
  signOutEverywhere,
  updateProfile,
} from '@calorya/api';
import {
  ACTIVITY_HINT,
  ACTIVITY_LABEL,
  ACTIVITY_LEVELS,
  GOAL_LABEL,
  targetsSchema,
  todayKey,
  type ActivityLevel,
  type Goal,
  authErrorMessage,
  credentialsSchema,
} from '@calorya/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
import { useSession } from '../_layout';
import {
  CheckIcon,
  HeartIcon,
  MoonIcon,
  PhoneIcon,
  SunIcon,
} from '../../src/components/icons';
import {
  Button,
  Card,
  ConfirmModal,
  ErrorNote,
  PasswordInput,
} from '../../src/components/ui';
import { qk, useProfile, useTargets } from '../../src/lib/hooks';
import { privacyUrl } from '../../src/lib/site';
import { supabase } from '../../src/lib/supabase';
import {
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '../../src/lib/theme';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

const GOALS: readonly Goal[] = ['lose', 'maintain', 'gain'];

/** The eight numbers, in the order they are worth reading. */
const TARGET_FIELDS = [
  { key: 'kcal', label: 'Kalori', unit: 'kkal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Karbohidrat', unit: 'g' },
  { key: 'fatG', label: 'Lemak', unit: 'g' },
  { key: 'fiberG', label: 'Serat', unit: 'g' },
  { key: 'waterMl', label: 'Air', unit: 'ml' },
  { key: 'sleepMin', label: 'Tidur', unit: 'menit' },
  { key: 'steps', label: 'Langkah', unit: 'langkah' },
] as const;

type TargetForm = Record<(typeof TARGET_FIELDS)[number]['key'], string>;

const EMPTY_FORM: TargetForm = {
  kcal: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  fiberG: '',
  waterMl: '',
  sleepMin: '',
  steps: '',
};

export default function ProfilScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, refreshGate } = useSession();

  const { data: profile } = useProfile();
  const timezone =
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jakarta';
  const day = todayKey(timezone);
  const { data: targets } = useTargets(day);

  const [form, setForm] = useState<TargetForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!targets) return;
    setForm({
      kcal: String(targets.kcal),
      proteinG: String(targets.proteinG),
      carbsG: String(targets.carbsG),
      fatG: String(targets.fatG),
      fiberG: String(targets.fiberG),
      waterMl: String(targets.waterMl),
      sleepMin: String(targets.sleepMin),
      steps: String(targets.steps),
    });
  }, [targets]);

  async function patchProfile(patch: { activityLevel?: ActivityLevel; goal?: Goal }) {
    setError(null);
    try {
      await updateProfile(supabase, patch);
      await queryClient.invalidateQueries({ queryKey: qk.profile });
    } catch (err) {
      setError(err);
    }
  }

  async function submitTargets() {
    setError(null);
    const parsed = targetsSchema.safeParse(form);
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0]?.message ?? 'Nilai target tidak valid'));
      return;
    }

    setSaving(true);
    try {
      // A new target version starts today; past days keep the goals they were
      // actually scored against.
      await saveTargets(supabase, parsed.data, day);
      await queryClient.invalidateQueries({ queryKey: ['targets'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Name and password, editable after setup.
   *
   * Both were write-once before this: the name could only be set during
   * onboarding, and the password only at sign-up or through the emailed reset
   * link. Neither is a reasonable place to leave someone — a typo in your own
   * name should not need a support request, and changing a password should not
   * require pretending to have forgotten it.
   */
  const [nameDraft, setNameDraft] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    if (profile?.fullName != null) setNameDraft(profile.fullName);
  }, [profile?.fullName]);

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0 || trimmed === (profile?.fullName ?? '')) return;
    setError(null);
    setNameBusy(true);
    try {
      await updateProfile(supabase, { fullName: trimmed });
      await queryClient.invalidateQueries({ queryKey: qk.profile });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setError(err);
    } finally {
      setNameBusy(false);
    }
  }

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordDone, setPasswordDone] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function savePassword() {
    setPasswordError(null);
    const parsed = credentialsSchema.shape.password.safeParse(password);
    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message ?? 'Kata sandi tidak valid');
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordError('Konfirmasi kata sandi belum sama.');
      return;
    }
    setPasswordBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword('');
      setPasswordConfirm('');
      setPasswordDone(true);
      setTimeout(() => setPasswordDone(false), 3000);
    } catch (err) {
      setPasswordError(authErrorMessage(err));
    } finally {
      setPasswordBusy(false);
    }
  }

  /**
   * Signing out is confirmed because it is easy to hit by accident and, with
   * email confirmation in play, getting back in is not always instant.
   *
   * The confirmation is a real Modal, not Alert.alert: Alert's buttons are not
   * implemented on React Native Web, so on the web build the prompt appeared
   * with nothing to press and the whole action silently never ran.
   */
  const [askSignOut, setAskSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<unknown>(null);

  async function doSignOut() {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOutEverywhere(supabase);
      // Cached data belongs to the account that just left.
      queryClient.clear();
      setAskSignOut(false);
      // No navigation here: the root gate watches the session and moves to
      // /login by itself. Pushing a route as well would race it.
    } catch (err) {
      // Shown inside the sheet rather than swallowed — the old version awaited
      // signOut() with no catch, so a failed revoke left the button looking
      // like it did nothing at all.
      setSignOutError(err);
    } finally {
      setSigningOut(false);
    }
  }

  const name = profile?.fullName?.trim() || 'Tanpa nama';
  const initial = name.charAt(0).toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenTitle}>Profil</Text>

        <Card>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {session?.user.email ?? '—'}
              </Text>
              <Text style={styles.meta}>Zona waktu: {timezone}</Text>
            </View>
          </View>
        </Card>

        {error != null && <ErrorNote error={error} />}

        <Card>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Nama</Text>
            {nameSaved ? <Text style={styles.savedTag}>Tersimpan</Text> : null}
          </View>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder="Nama panggilan"
            placeholderTextColor={theme.textDim}
            style={styles.input}
            maxLength={80}
            accessibilityLabel="Nama"
          />
          <Button
            label="Simpan nama"
            variant="ghost"
            loading={nameBusy}
            disabled={nameDraft.trim() === (profile?.fullName ?? '')}
            onPress={() => void saveName()}
          />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Kata sandi</Text>
          {passwordDone ? (
            <Text style={styles.savedTag}>Kata sandi berhasil diganti.</Text>
          ) : null}
          {/*
            Both fields carry their own placeholder. Two identical password
            boxes with the same grey "Minimal 8 karakter" in them is a small
            puzzle to solve every time, and the puzzle has a wrong answer.
          */}
          <Text style={styles.label}>Kata sandi baru</Text>
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
          />
          <View style={{ height: spacing.sm }} />
          <Text style={styles.label}>Ulangi kata sandi</Text>
          <PasswordInput
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="Ketik ulang sandi baru"
            autoComplete="new-password"
          />
          {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
          <Button
            label="Ganti kata sandi"
            variant="ghost"
            loading={passwordBusy}
            disabled={password.length === 0}
            onPress={() => void savePassword()}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Tingkat aktivitas</Text>
          <Text style={styles.cardHint}>
            Dipakai menghitung kebutuhan kalori harianmu.
          </Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {ACTIVITY_LEVELS.map((level) => {
              const active = profile?.activityLevel === level;
              return (
                <Pressable
                  key={level}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => void patchProfile({ activityLevel: level })}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                      {ACTIVITY_LABEL[level]}
                    </Text>
                    <Text style={styles.optionHint}>{ACTIVITY_HINT[level]}</Text>
                  </View>
                  {active ? <CheckIcon color={theme.brand} size={18} weight={2.4} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Tujuan</Text>
          <View style={styles.goalRow}>
            {GOALS.map((goal) => {
              const active = profile?.goal === goal;
              return (
                <Pressable
                  key={goal}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => void patchProfile({ goal })}
                  style={[styles.goal, active && styles.optionActive]}
                >
                  <Text style={[styles.goalText, active && styles.optionLabelActive]}>
                    {GOAL_LABEL[goal]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Target harian</Text>
            {saved ? <Text style={styles.savedTag}>Tersimpan</Text> : null}
          </View>
          <Text style={styles.cardHint}>
            Berlaku mulai hari ini. Hari-hari sebelumnya tetap dinilai dengan target
            yang berlaku saat itu.
          </Text>

          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            {TARGET_FIELDS.map((field) => (
              <View key={field.key} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <View style={styles.fieldInputWrap}>
                  <TextInput
                    value={form[field.key]}
                    onChangeText={(value) =>
                      setForm((previous) => ({ ...previous, [field.key]: value }))
                    }
                    keyboardType="numeric"
                    style={styles.fieldInput}
                    accessibilityLabel={`Target ${field.label} dalam ${field.unit}`}
                  />
                  <Text style={styles.fieldUnit}>{field.unit}</Text>
                </View>
              </View>
            ))}
          </View>

          <Button
            label="Simpan target"
            onPress={() => void submitTargets()}
            loading={saving}
            style={{ marginTop: spacing.lg }}
          />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Catatan kesehatan</Text>
          <Text style={styles.cardHint}>
            Air, tidur, langkah, dan berat badan dicatat di layar terpisah.
          </Text>
          <Button
            label="Buka catatan kesehatan"
            variant="ghost"
            onPress={() => router.push('/health')}
            icon={<HeartIcon color={theme.text} size={18} weight={1.9} />}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Tampilan</Text>
          <ThemePicker />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Panduan</Text>
          <Text style={styles.cardHint}>
            Perkenalan singkat tentang cara mencatat makanan, air dan progress.
          </Text>
          <Button
            label="Lihat tutorial lagi"
            variant="ghost"
            onPress={() => {
              // Clearing the column and re-reading it is the same path a new
              // account takes, so there is only one way into the slides.
              void setTutorialSeen(supabase, false)
                .then(() => queryClient.invalidateQueries({ queryKey: qk.profile }))
                .then(refreshGate);
            }}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Privasi</Text>
          <Text style={styles.cardHint}>
            Catatanmu hanya bisa dibaca oleh akunmu. Tidak ada iklan dan tidak ada
            pelacak di aplikasi ini.
          </Text>
          {privacyUrl() ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(privacyUrl()!)}
              style={{ marginTop: spacing.md }}
            >
              <Text style={styles.link}>Baca kebijakan privasi</Text>
            </Pressable>
          ) : null}
        </Card>

        <Button
          label="Keluar"
          variant="ghost"
          onPress={() => {
            setSignOutError(null);
            setAskSignOut(true);
          }}
        />
        {/* Read from the manifest so it cannot drift from app.json. */}
        <Text style={styles.footer}>
          Calorya · versi {Constants.expoConfig?.version ?? '—'}
        </Text>
      </ScrollView>

      <ConfirmModal
        visible={askSignOut}
        title="Keluar dari akun?"
        message="Sesi di perangkat ini akan dihapus dan token-nya dicabut. Catatanmu tetap tersimpan dan menunggu kamu kembali."
        confirmLabel="Keluar"
        destructive
        busy={signingOut}
        error={signOutError}
        onConfirm={() => void doSignOut()}
        onCancel={() => setAskSignOut(false)}
      />
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
    screenTitle: { color: theme.text, fontSize: 22, fontWeight: '700' },
    identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      backgroundColor: theme.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: theme.brand, fontSize: 22, fontWeight: '700' },
    name: { color: theme.text, fontSize: 16, fontWeight: '700' },
    meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
    cardHint: { color: theme.textDim, fontSize: 12, marginTop: 4, lineHeight: 18 },
    savedTag: { color: theme.brand, fontSize: 12, fontWeight: '700' },
    fieldError: { color: theme.danger, fontSize: 12, marginTop: 6 },
    label: { color: theme.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
    input: {
      backgroundColor: theme.bg,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 15,
      marginVertical: spacing.md,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    optionActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    optionLabel: { color: theme.text, fontSize: 14, fontWeight: '600' },
    optionLabelActive: { color: theme.brand },
    optionHint: { color: theme.textDim, fontSize: 11, marginTop: 2 },
    goalRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    goal: {
      flex: 1,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
    },
    goalText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    fieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    fieldLabel: { color: theme.textMuted, fontSize: 13, flex: 1 },
    fieldInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      backgroundColor: theme.surface,
      minWidth: 138,
    },
    fieldInput: {
      flex: 1,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 15,
      textAlign: 'right',
    },
    fieldUnit: { color: theme.textDim, fontSize: 11 },
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
    link: { color: theme.brand, fontSize: 14, fontWeight: '600' },
    footer: {
      color: theme.textDim,
      fontSize: 11,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });
