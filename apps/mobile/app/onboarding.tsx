import { completeOnboarding } from "@calorya/api";
import {
  ACTIVITY_HINT,
  ACTIVITY_LABEL,
  ACTIVITY_LEVELS,
  bmi,
  bmiCategory,
  BMI_LABEL,
  credentialsSchema,
  deriveTargets,
  formatKcal,
  formatVolume,
  GOAL_LABEL,
  ONBOARDING_DRAFT_KEY,
  ONBOARDING_STEPS,
  onboardingSchema,
  parseOnboardingDraft,
  serialiseOnboardingDraft,
  SEX_LABEL,
  todayKey,
  validateOnboardingStep,
  type ActivityLevel,
  type Goal,
  type Sex,
} from "@calorya/core";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckIcon } from "../src/components/icons";
import { Button, Card, ErrorNote, PasswordInput } from "../src/components/ui";
import { DateField } from "../src/components/date-field";
import { supabase } from "../src/lib/supabase";
import { useSession } from "./_layout";
import {
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from "../src/lib/theme";

const SEXES: readonly Sex[] = ["female", "male"];
const GOALS: readonly Goal[] = ["lose", "maintain", "gain"];

/**
 * The questions that turn a signup into a usable account.
 *
 * Until this screen existed, anyone who registered in the app kept the generic
 * targets the database seeds on signup — 2000 kcal for everyone, whoever they
 * are. The Mifflin-St Jeor maths and its tests were already in @calorya/core;
 * nothing on mobile ever collected the inputs it needs.
 *
 * The live preview at the bottom is not decoration. Someone typing their
 * weight into a health app deserves to see what the app concludes from it
 * before committing, and it turns an abstract form into an obviously useful
 * one.
 */
export default function OnboardingScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session, refreshGate } = useSession();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("1998-01-01");
  const [sex, setSex] = useState<Sex>("female");
  const [heightCm, setHeightCm] = useState("165");
  const [weightKg, setWeightKg] = useState("60");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("light");
  const [goal, setGoal] = useState<Goal>("maintain");

  /** Optional. Empty means "keep the password chosen at sign-up". */
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);
  const step = ONBOARDING_STEPS[stepIndex]!;
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  const userId = session?.user.id ?? "";
  /**
   * Until the saved draft has been read, nothing is written back — otherwise
   * the empty initial state would overwrite the answers we are about to load.
   */
  const [restored, setRestored] = useState(false);

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Asia/Jakarta";

  /** Recomputed on every keystroke, in the app, with no network involved. */
  const preview = useMemo(() => {
    const height = Number(heightCm);
    const weight = Number(weightKg);
    const birth = new Date(birthDate);
    if (!Number.isFinite(height) || height < 80) return null;
    if (!Number.isFinite(weight) || weight < 20) return null;
    if (Number.isNaN(birth.getTime())) return null;

    const ageYears = Math.floor(
      (Date.now() - birth.getTime()) / 31_557_600_000,
    );
    if (ageYears < 13 || ageYears > 120) return null;

    const targets = deriveTargets(
      { sex, weightKg: weight, heightCm: height, ageYears },
      activityLevel,
      goal,
    );
    return { targets, bmiValue: bmi(weight, height) };
  }, [birthDate, sex, heightCm, weightKg, activityLevel, goal]);

  const values = {
    fullName,
    birthDate,
    sex,
    heightCm,
    weightKg,
    activityLevel,
    goal,
  };

  /*
   * Resume where they left off.
   *
   * Being interrupted mid-setup — a call, a battery warning, going to find the
   * bathroom scales — used to cost every answer already given, because closing
   * the app dropped the component state and reopening rebuilt it empty. That
   * is precisely the moment people abandon a signup.
   *
   * The draft is keyed to the account, so a shared phone never offers one
   * person's height to the next. The optional password is not part of it: a
   * password sitting in clear text in device storage is a real hazard, and the
   * one field nobody minds retyping.
   */
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void AsyncStorage.getItem(ONBOARDING_DRAFT_KEY)
      .then((raw) => {
        if (!alive) return;
        const draft = parseOnboardingDraft(raw, userId);
        if (draft) {
          if (draft.fullName) setFullName(draft.fullName);
          if (draft.birthDate) setBirthDate(draft.birthDate);
          if (draft.sex) setSex(draft.sex as Sex);
          if (draft.heightCm) setHeightCm(draft.heightCm);
          if (draft.weightKg) setWeightKg(draft.weightKg);
          if (draft.activityLevel)
            setActivityLevel(draft.activityLevel as ActivityLevel);
          if (draft.goal) setGoal(draft.goal as Goal);
          setStepIndex(draft.step);
        }
        setRestored(true);
      })
      .catch(() => {
        // Unreadable storage costs the draft, nothing else.
        if (alive) setRestored(true);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  // Save on every change. AsyncStorage writes are cheap next to the cost of
  // losing the answers, and a debounce would drop the last keystrokes exactly
  // when the app is being killed — the case this exists for.
  const saved = useRef("");
  useEffect(() => {
    if (!restored || !userId) return;
    const payload = serialiseOnboardingDraft({
      userId,
      step: stepIndex,
      ...values,
    });
    if (payload === saved.current) return;
    saved.current = payload;
    void AsyncStorage.setItem(ONBOARDING_DRAFT_KEY, payload).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    restored,
    userId,
    stepIndex,
    fullName,
    birthDate,
    sex,
    heightCm,
    weightKg,
    activityLevel,
    goal,
  ]);

  /** Advance only if this step's own fields are valid. */
  function next() {
    const stepErrors = validateOnboardingStep(step.id, values);

    // The optional password belongs to the identity step, so it is checked
    // here. Discovering on the last screen that a password typed three steps
    // ago is too short is a miserable way to learn it.
    if (step.id === "identity" && password.length > 0) {
      const parsed = credentialsSchema.shape.password.safeParse(password);
      if (!parsed.success) {
        stepErrors["password"] =
          parsed.error.issues[0]?.message ?? "Sandi tidak valid";
      }
    }

    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    setStepIndex((i) => i + 1);
  }

  async function submit() {
    setErrors({});
    const parsed = onboardingSchema.safeParse({
      fullName,
      birthDate,
      sex,
      heightCm,
      weightKg,
      activityLevel,
      goal,
      timezone,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key])
          fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      // Land on the step that owns the first bad field: announcing an error on
      // a screen that does not contain the input is how a form feels broken.
      const owner = ONBOARDING_STEPS.findIndex(
        (s) => Object.keys(validateOnboardingStep(s.id, values)).length > 0,
      );
      if (owner >= 0) setStepIndex(owner);
      return;
    }

    setBusy(true);
    try {
      // Password first, deliberately. If it fails nothing has been written
      // yet; doing it after would leave a saved profile and a password that
      // silently did not change.
      if (password.length > 0) {
        const { error: pwError } = await supabase.auth.updateUser({ password });
        if (pwError) throw pwError;
      }

      await completeOnboarding(
        supabase,
        parsed.data,
        todayKey(parsed.data.timezone),
      );
      // Saved for real; the draft has nothing left to protect.
      void AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY).catch(() => {});
      // The profile and targets both changed; nothing cached is still true.
      queryClient.clear();
      // Navigating from here would race the root gate, which still holds
      // `onboarded: false` and would bounce us straight back to this form.
      // Re-reading the columns instead lets the gate move us on — to the
      // intro slides — so there is exactly one place that decides the route.
      refreshGate();
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : "Gagal menyimpan profil",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={styles.brand}>Calorya</Text>

            {/* Progress: the same bar-and-label pattern as the tutorial, so the
                two first-run screens read as one flow, not two products. */}
            <View style={styles.steps} accessibilityRole="progressbar">
              {ONBOARDING_STEPS.map((s, i) => (
                <View key={s.id} style={{ flex: 1 }}>
                  <View
                    style={[styles.stepBar, i <= stepIndex && styles.stepBarOn]}
                  />
                  <Text
                    style={[
                      styles.stepLabel,
                      i <= stepIndex && styles.stepLabelOn,
                    ]}
                  >
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.subtitle}>{step.hint}</Text>
          </View>

          {errors["form"] ? (
            <ErrorNote error={new Error(errors["form"])} />
          ) : null}

          {step.id === "identity" ? (
            <Card>
              <Field label="Nama" error={errors["fullName"]} styles={styles}>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Nama panggilan saja boleh"
                  placeholderTextColor={theme.textDim}
                  style={styles.input}
                />
              </Field>

              {/*
              A picker, not a text box. Asking someone to type "1996-04-12"
              means asking them to know a format, and rejecting "12/04/1996"
              — which is how most people here would write it.
            */}
              <View style={{ marginBottom: spacing.md }}>
                <DateField
                  label="Tanggal lahir"
                  value={birthDate}
                  onChange={setBirthDate}
                  error={errors["birthDate"]}
                  maxYear={new Date().getFullYear() - 13}
                />
              </View>

              <Field label="Jenis kelamin" styles={styles}>
                <View style={styles.row}>
                  {SEXES.map((option) => {
                    const active = sex === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => setSex(option)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {SEX_LABEL[option]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.hint}>
                  Dipakai di rumus Mifflin-St Jeor untuk menghitung kebutuhan
                  energi.
                </Text>
              </Field>

              {/* <Field
              label="Ganti kata sandi (opsional)"
              error={errors['password']}
              styles={styles}
            >
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                autoComplete="new-password"
              />
              <Text style={styles.hint}>
                Kosongkan kalau sandi yang kamu buat saat daftar sudah pas.
              </Text>
            </Field> */}
            </Card>
          ) : null}

          {step.id === "body" ? (
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Tinggi (cm)"
                    error={errors["heightCm"]}
                    styles={styles}
                  >
                    <TextInput
                      value={heightCm}
                      onChangeText={setHeightCm}
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Berat (kg)"
                    error={errors["weightKg"]}
                    styles={styles}
                  >
                    <TextInput
                      value={weightKg}
                      onChangeText={setWeightKg}
                      keyboardType="decimal-pad"
                      style={styles.input}
                    />
                  </Field>
                </View>
              </View>
              {preview ? (
                <Text style={[styles.hint, { color: theme.move }]}>
                  BMI-mu {preview.bmiValue} ·{" "}
                  {BMI_LABEL[bmiCategory(preview.bmiValue)]} (ambang WHO
                  Asia-Pasifik)
                </Text>
              ) : null}
            </Card>
          ) : null}

          {step.id === "targets" ? (
            <>
              <Card>
                <Text style={styles.cardTitle}>Tingkat aktivitas</Text>
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {ACTIVITY_LEVELS.map((level) => {
                    const active = activityLevel === level;
                    return (
                      <Pressable
                        key={level}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => setActivityLevel(level)}
                        style={[styles.option, active && styles.optionActive]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.optionLabel,
                              active && styles.optionLabelActive,
                            ]}
                          >
                            {ACTIVITY_LABEL[level]}
                          </Text>
                          <Text style={styles.optionHint}>
                            {ACTIVITY_HINT[level]}
                          </Text>
                        </View>
                        {active ? (
                          <CheckIcon
                            color={theme.brand}
                            size={18}
                            weight={2.4}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </Card>

              <Card>
                <Text style={styles.cardTitle}>Tujuan</Text>
                <View style={[styles.row, { marginTop: spacing.md }]}>
                  {GOALS.map((option) => {
                    const active = goal === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => setGoal(option)}
                        style={[styles.goal, active && styles.optionActive]}
                      >
                        <Text
                          style={[
                            styles.goalText,
                            active && styles.optionLabelActive,
                          ]}
                        >
                          {GOAL_LABEL[option]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>

              {preview ? (
                <Card
                  style={{
                    backgroundColor: theme.brandSoft,
                    borderColor: theme.brandDim,
                  }}
                >
                  <Text style={styles.cardTitle}>Target harianmu</Text>
                  <Text style={styles.previewHint}>
                    Dihitung dari jawabanmu. Bisa disesuaikan kapan saja.
                  </Text>
                  <View style={styles.previewGrid}>
                    <Preview
                      label="Kalori"
                      value={formatKcal(preview.targets.kcal)}
                      styles={styles}
                    />
                    <Preview
                      label="Protein"
                      value={`${preview.targets.proteinG} g`}
                      styles={styles}
                    />
                    <Preview
                      label="Karbohidrat"
                      value={`${preview.targets.carbsG} g`}
                      styles={styles}
                    />
                    <Preview
                      label="Lemak"
                      value={`${preview.targets.fatG} g`}
                      styles={styles}
                    />
                    <Preview
                      label="Air"
                      value={formatVolume(preview.targets.waterMl)}
                      styles={styles}
                    />
                    <Preview
                      label="BMI"
                      value={`${preview.bmiValue} · ${BMI_LABEL[bmiCategory(preview.bmiValue)]}`}
                      styles={styles}
                    />
                  </View>
                </Card>
              ) : null}
            </>
          ) : null}

          <View style={styles.actions}>
            {stepIndex > 0 ? (
              <Button
                label="Kembali"
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  setErrors({});
                  setStepIndex((i) => i - 1);
                }}
                style={{ flex: 1 }}
              />
            ) : null}
            <Button
              label={isLast ? "Simpan & mulai" : "Lanjut"}
              onPress={() => (isLast ? void submit() : next())}
              loading={busy}
              style={{ flex: 2 }}
            />
          </View>

          <Text style={styles.footer}>
            Langkah {stepIndex + 1} dari {ONBOARDING_STEPS.length} · semuanya
            bisa diubah lagi di Profil · zona waktu {timezone}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  error,
  styles,
  children,
}: {
  label: string;
  error?: string;
  styles: ReturnType<typeof makeStyles>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Preview({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.previewCell}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    steps: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
    },
    stepBar: { height: 5, borderRadius: 3, backgroundColor: theme.border },
    stepBarOn: { backgroundColor: theme.brand },
    stepLabel: { color: theme.textDim, fontSize: 12, marginTop: 6 },
    stepLabelOn: { color: theme.textMuted },
    actions: { flexDirection: "row", gap: spacing.sm },
    brand: {
      color: theme.brand,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 1,
    },
    title: { color: theme.text, fontSize: 26, fontWeight: "700", marginTop: 4 },
    subtitle: {
      color: theme.textDim,
      fontSize: 14,
      marginTop: 6,
      lineHeight: 19,
    },
    label: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 6,
    },
    hint: { color: theme.textDim, fontSize: 12, marginTop: 6, lineHeight: 16 },
    error: { color: theme.danger, fontSize: 13, marginTop: 4 },
    input: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 16,
    },
    row: { flexDirection: "row", gap: spacing.sm },
    chip: {
      flex: 1,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingVertical: 12,
    },
    chipActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    chipText: { color: theme.textMuted, fontSize: 15, fontWeight: "600" },
    chipTextActive: { color: theme.brand },
    cardTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    optionActive: {
      borderColor: theme.brand,
      backgroundColor: theme.brandSoft,
    },
    optionLabel: { color: theme.text, fontSize: 15, fontWeight: "600" },
    optionLabelActive: { color: theme.brand },
    optionHint: { color: theme.textDim, fontSize: 12, marginTop: 2 },
    goal: {
      flex: 1,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
    },
    goalText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
    },
    previewHint: { color: theme.textDim, fontSize: 13, marginTop: 4 },
    previewGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    previewCell: { width: "46%" },
    previewLabel: { color: theme.textDim, fontSize: 12 },
    previewValue: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 2,
    },
    footer: { color: theme.textDim, fontSize: 12, textAlign: "center" },
  });
