import {
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  foodSchema,
  type Food,
  type FoodCategory,
} from '@calorya/core';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCreateFood } from '../lib/hooks';
import { radius, spacing, useTheme, useThemedStyles, type Theme } from '../lib/theme';
import { Button, ErrorNote } from './ui';

/**
 * Add a food that is not in the catalogue.
 *
 * The app has been telling people to do this for a while — the barcode
 * not-found message literally reads "Tambahkan manual saja" — while offering
 * no way to. `createFood` existed in @calorya/api from the start, but the only
 * caller was the barcode importer, so a home-cooked dish, a warung meal or a
 * product Open Food Facts has never heard of was simply unloggable.
 *
 * Everything is per 100 g, matching how the rest of the app stores nutrition,
 * and only two fields are required: a name and the calories. Someone standing
 * in a warung is not going to type in sodium, and a food with honest calories
 * and blank micronutrients is far more useful than a food they gave up on.
 * The optional "takaran" pair is what makes a portion picker say
 * "1 piring ≈ 250 g" later.
 */
export function FoodForm({
  onCreated,
  onCancel,
  initialName = '',
  barcode = null,
}: {
  onCreated: (food: Food) => void;
  onCancel: () => void;
  /** Prefilled from whatever the user searched for and did not find. */
  initialName?: string;
  /** Prefilled when they got here from a barcode that matched nothing. */
  barcode?: string | null;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const createFood = useCreateFood();

  const [form, setForm] = useState({
    name: initialName,
    brand: '',
    kcal: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    fiberG: '',
    sugarG: '',
    sodiumMg: '',
    servingLabel: '',
    servingG: '',
  });
  const [category, setCategory] = useState<FoodCategory>(barcode ? 'packaged' : 'main');
  const [isLiquid, setIsLiquid] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  function submit() {
    setFieldError(null);

    /*
     * Blank means "I do not know", not zero — except for calories, which are
     * required. Empty optional numbers are dropped so the schema's own
     * defaults apply rather than coercing '' to 0 and claiming, on the food's
     * detail screen, that this dish definitely contains no protein.
     */
    const parsed = foodSchema.safeParse({
      name: form.name,
      brand: form.brand.trim() || null,
      barcode,
      kcal: form.kcal,
      proteinG: form.proteinG.trim() || 0,
      carbsG: form.carbsG.trim() || 0,
      fatG: form.fatG.trim() || 0,
      fiberG: form.fiberG.trim() || 0,
      sugarG: form.sugarG.trim() || 0,
      sodiumMg: form.sodiumMg.trim() || 0,
      servingLabel: form.servingLabel.trim() || null,
      servingG: form.servingG.trim() ? form.servingG : null,
      isLiquid,
      category,
    });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Ada isian yang belum benar.');
      return;
    }

    createFood.mutate(parsed.data, { onSuccess: onCreated });
  }

  const unit = isLiquid ? 'ml' : 'g';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Tambah makanan sendiri</Text>
        <Pressable onPress={onCancel} accessibilityRole="button">
          <Text style={styles.link}>Batal</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.lead}>
            Isi nilai gizinya <Text style={styles.leadStrong}>per 100 {unit}</Text> —
            biasanya ada di tabel “Informasi Nilai Gizi” pada kemasan. Cukup nama dan
            kalori kalau kamu tidak tahu sisanya.
          </Text>

          {barcode ? (
            <View style={styles.barcodeNote}>
              <Text style={styles.barcodeNoteText}>
                Barcode {barcode} akan ikut tersimpan, jadi berikutnya cukup dipindai.
              </Text>
            </View>
          ) : null}

          <Labelled label="Nama makanan" required>
            <TextInput
              value={form.name}
              onChangeText={set('name')}
              placeholder="Nasi goreng kampung"
              placeholderTextColor={theme.textDim}
              style={styles.input}
              maxLength={120}
              accessibilityLabel="Nama makanan"
            />
          </Labelled>

          <Labelled label="Merek atau warung" hint="Opsional">
            <TextInput
              value={form.brand}
              onChangeText={set('brand')}
              placeholder="Warung Bu Tini"
              placeholderTextColor={theme.textDim}
              style={styles.input}
              maxLength={80}
              accessibilityLabel="Merek"
            />
          </Labelled>

          <Labelled label="Kategori">
            <View style={styles.chips}>
              {(Object.keys(CATEGORY_LABEL) as FoodCategory[]).map((key) => {
                const active = category === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setCategory(key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {CATEGORY_EMOJI[key]} {CATEGORY_LABEL[key]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Labelled>

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: isLiquid }}
            onPress={() => setIsLiquid((on) => !on)}
            style={[styles.toggle, isLiquid && styles.chipActive]}
          >
            <Text style={[styles.chipText, isLiquid && styles.chipTextActive]}>
              {isLiquid ? '✓ ' : ''}Ini minuman (dihitung dalam ml)
            </Text>
          </Pressable>

          <Text style={styles.sectionTitle}>Per 100 {unit}</Text>

          <Labelled label="Kalori" required hint="kkal">
            <TextInput
              value={form.kcal}
              onChangeText={set('kcal')}
              keyboardType="numeric"
              placeholder="185"
              placeholderTextColor={theme.textDim}
              style={styles.input}
              accessibilityLabel="Kalori per 100 gram"
            />
          </Labelled>

          <View style={styles.grid}>
            <NumberCell label="Protein (g)" value={form.proteinG} onChange={set('proteinG')} />
            <NumberCell label="Karbo (g)" value={form.carbsG} onChange={set('carbsG')} />
            <NumberCell label="Lemak (g)" value={form.fatG} onChange={set('fatG')} />
            <NumberCell label="Serat (g)" value={form.fiberG} onChange={set('fiberG')} />
            <NumberCell label="Gula (g)" value={form.sugarG} onChange={set('sugarG')} />
            <NumberCell label="Natrium (mg)" value={form.sodiumMg} onChange={set('sodiumMg')} />
          </View>

          <Text style={styles.sectionTitle}>Takaran biasa</Text>
          <Text style={styles.lead}>
            Opsional, tapi ini yang membuat aplikasi bisa menawarkan “1 piring” alih-alih
            memintamu menghitung gram tiap kali.
          </Text>

          <View style={styles.grid}>
            <Labelled label="Sebutannya" style={{ flex: 1, minWidth: 150 }}>
              <TextInput
                value={form.servingLabel}
                onChangeText={set('servingLabel')}
                placeholder="1 piring"
                placeholderTextColor={theme.textDim}
                style={styles.input}
                maxLength={40}
                accessibilityLabel="Sebutan takaran"
              />
            </Labelled>
            <Labelled label={`Beratnya (${unit})`} style={{ flex: 1, minWidth: 150 }}>
              <TextInput
                value={form.servingG}
                onChangeText={set('servingG')}
                keyboardType="numeric"
                placeholder="250"
                placeholderTextColor={theme.textDim}
                style={styles.input}
                accessibilityLabel={`Berat satu takaran dalam ${unit}`}
              />
            </Labelled>
          </View>

          {fieldError ? <ErrorNote error={new Error(fieldError)} /> : null}
          {createFood.error != null ? <ErrorNote error={createFood.error} /> : null}

          <Text style={styles.privacy}>
            Makanan ini hanya muncul di akunmu, tidak ditambahkan ke katalog bersama.
          </Text>

          <Button
            label="Simpan lalu catat"
            onPress={submit}
            loading={createFood.isPending}
            disabled={form.name.trim().length === 0 || form.kcal.trim().length === 0}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Labelled({
  label,
  hint,
  required = false,
  style,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  style?: object;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
        {hint ? <Text style={styles.hint}>  {hint}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

function NumberCell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flex: 1, minWidth: 100, gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={theme.textDim}
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: { color: theme.text, fontSize: 18, fontWeight: '700' },
    link: { color: theme.brand, fontSize: 15, fontWeight: '600' },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      // Clears the floating tab bar, which is absolutely positioned over the
      // content. The same figure every other tab screen uses; anything less
      // hides the last field behind it.
      paddingBottom: spacing.xxl * 2,
    },
    lead: { color: theme.textDim, fontSize: 14, lineHeight: 20 },
    leadStrong: { color: theme.textMuted, fontWeight: '700' },
    sectionTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
    label: { color: theme.textMuted, fontSize: 14, fontWeight: '500' },
    required: { color: theme.danger },
    hint: { color: theme.textDim, fontWeight: '400' },
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipActive: { borderColor: theme.brand, backgroundColor: theme.surface },
    chipText: { color: theme.textDim, fontSize: 14 },
    chipTextActive: { color: theme.brand, fontWeight: '600' },
    toggle: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    barcodeNote: {
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    barcodeNoteText: { color: theme.textMuted, fontSize: 14 },
    privacy: { color: theme.textDim, fontSize: 13, lineHeight: 18 },
  });
