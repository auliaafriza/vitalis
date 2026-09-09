import { groupByMeal } from '@calorya/api';
import {
  addDays,
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  CATEGORY_TINT,
  defaultPortionG,
  FEATURED_CATEGORIES,
  formatKcal,
  macroSplit,
  MEAL_LABEL,
  mealForHour,
  nutrientsForQuantity,
  sumNutrients,
  todayKey,
  type Food,
  type FoodCategory,
  type MealType,
} from '@calorya/core';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarcodeIcon, PlusIcon, SearchIcon } from '../../src/components/icons';
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  ProgressBar,
  Segmented,
} from '../../src/components/ui';
import {
  useAddFood,
  useCopyMeal,
  useDeleteFood,
  useFoodEntries,
  useUpdateFoodQuantity,
  useFoodSearch,
  useProfile,
  useRecentFoods,
  useResolveBarcode,
  useTargets,
} from '../../src/lib/hooks';
import { BarcodeScanner } from '../../src/components/barcode-scanner';
import {
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '../../src/lib/theme';

const MEAL_OPTIONS = (['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => ({
  value: meal,
  label: MEAL_LABEL[meal],
}));

export default function NutritionScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ add?: string }>();

  const { data: profile } = useProfile();
  const timezone =
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jakarta';
  const day = todayKey(timezone);

  const { data: entries, error } = useFoodEntries(day);
  const { data: targets } = useTargets(day);
  const { data: recent } = useRecentFoods();
  const deleteFood = useDeleteFood(day);
  const updateQuantity = useUpdateFoodQuantity(day);

  /**
   * Repeating yesterday, offered only where a meal is still empty: copying
   * into a meal that already has entries is how people end up eating lunch
   * twice on paper.
   */
  const copyMeal = useCopyMeal(day);
  const yesterday = addDays(day, -1);
  /** The meal whose copy found nothing — said out loud instead of no-op. */
  const [nothingToCopy, setNothingToCopy] = useState<MealType | null>(null);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [chosen, setChosen] = useState<Food | null>(null);
  /** The logged entry being corrected, if any. */
  const [editing, setEditing] = useState<{ id: string; name: string; quantityG: number } | null>(
    null,
  );
  const searchRef = useRef<TextInput>(null);

  // The + button in the tab bar lands here with ?add=1 and should feel like it
  // opened something, so it puts the cursor in the search field.
  useEffect(() => {
    if (params.add) searchRef.current?.focus();
  }, [params.add]);

  const trimmed = query.trim();
  const browsing = trimmed.length > 0 || category !== null;
  const { data: results } = useFoodSearch(trimmed, category);

  /**
   * The scanner deliberately lives OUTSIDE any Modal.
   *
   * CameraView renders into its own native surface, and nesting that inside a
   * React Native Modal is the classic way to get a preview that stays black on
   * Android — the Modal is a separate window and the camera surface never gets
   * attached to it. Scanning is a full-screen step of its own instead, which is
   * also the better shape for holding a phone up to a package.
   */
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const resolve = useResolveBarcode();

  function closeScanner() {
    setScanning(false);
    setScanNote(null);
  }

  function handleBarcode(barcode: string) {
    setScanNote(null);
    resolve.mutate(barcode, {
      onSuccess: (result) => {
        if (result.status === 'catalogue' || result.status === 'imported') {
          closeScanner();
          setChosen(result.food);
          return;
        }
        setScanNote(
          result.status === 'not_found'
            ? 'Produk ini belum ada di database mana pun. Tambahkan manual saja.'
            : result.status === 'unusable'
              ? 'Produk ditemukan tapi data gizinya tidak lengkap.'
              : result.status === 'invalid_barcode'
                ? 'Angka barcode tidak valid.'
                : 'Tidak ada koneksi ke database produk. Coba lagi nanti.',
        );
      },
    });
  }

  const groups = useMemo(() => groupByMeal(entries ?? []), [entries]);
  const totals = useMemo(() => sumNutrients(entries ?? []), [entries]);
  const split = useMemo(() => macroSplit(totals), [totals]);

  if (error) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <View style={{ padding: spacing.lg }}>
          <ErrorNote error={error} />
        </View>
      </SafeAreaView>
    );
  }

  // Full-screen scanner: a plain screen, not a Modal. See the note above.
  if (scanning) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Pindai barcode</Text>
          <Pressable onPress={closeScanner} accessibilityRole="button">
            <Text style={styles.link}>Batal</Text>
          </Pressable>
        </View>
        <BarcodeScanner
          onDetected={handleBarcode}
          onCancel={closeScanner}
          busy={resolve.isPending}
          note={scanNote}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Catat Makanan</Text>
        <Text style={styles.subtitle}>
          Cari atau pindai makanan, langsung lihat informasi kalorinya.
        </Text>

        <View style={styles.searchRow}>
          <SearchIcon color={theme.textDim} size={18} weight={1.8} />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Cari makanan, contoh: nasi, ayam, apel…"
            placeholderTextColor={theme.textDim}
            style={styles.searchInput}
            returnKeyType="search"
          />
          <Pressable
            onPress={() => setScanning(true)}
            accessibilityRole="button"
            accessibilityLabel="Pindai barcode"
            hitSlop={8}
          >
            <BarcodeIcon color={theme.textMuted} size={20} weight={1.8} />
          </Pressable>
        </View>

        {browsing ? (
          <View style={{ gap: spacing.md }}>
            <View style={styles.browseHeader}>
              <Text style={styles.sectionTitle}>
                {category ? CATEGORY_LABEL[category] : `Hasil untuk “${trimmed}”`}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setCategory(null);
                  setQuery('');
                }}
              >
                <Text style={styles.link}>Selesai</Text>
              </Pressable>
            </View>

            {(results ?? []).length === 0 ? (
              <View style={{ gap: spacing.md }}>
                <EmptyState
                  title="Tidak ada hasil"
                  description="Kalau ini produk kemasan, barcode-nya biasanya lebih cepat ketemu daripada namanya."
                />
                <Button label="Pindai barcode" onPress={() => setScanning(true)} />
              </View>
            ) : (
              <View style={styles.list}>
                {(results ?? []).map((food) => (
                  <FoodRow
                    key={food.id}
                    food={food}
                    onPress={() => setChosen(food)}
                    styles={styles}
                    theme={theme}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Kategori Populer</Text>
            <View style={styles.grid}>
              {FEATURED_CATEGORIES.map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={CATEGORY_LABEL[key]}
                  onPress={() => setCategory(key)}
                  style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                >
                  <View style={[styles.tileIcon, { backgroundColor: CATEGORY_TINT[key] }]}>
                    <Text style={styles.tileEmoji}>{CATEGORY_EMOJI[key]}</Text>
                  </View>
                  <Text style={styles.tileLabel} numberOfLines={2}>
                    {CATEGORY_LABEL[key]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {recent && recent.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Terakhir Dicatat</Text>
                <View style={styles.list}>
                  {recent.slice(0, 5).map((food) => (
                    <FoodRow
                      key={food.id}
                      food={food}
                      onPress={() => setChosen(food)}
                      styles={styles}
                      theme={theme}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}

        <Card>
          <View style={styles.totalRow}>
            <Text style={styles.total}>{formatKcal(totals.kcal)}</Text>
            {targets ? (
              <Text style={styles.totalTarget}>dari {targets.kcal} kkal</Text>
            ) : null}
          </View>
          <ProgressBar
            value={totals.kcal}
            max={targets?.kcal ?? 2000}
            color={theme.food}
            label="Kalori harian"
          />
          {totals.kcal > 0 ? (
            <>
              <View style={styles.splitBar}>
                <View style={{ flex: split.protein, backgroundColor: theme.body }} />
                <View style={{ flex: split.carbs, backgroundColor: theme.move }} />
                <View style={{ flex: split.fat, backgroundColor: theme.sleep }} />
              </View>
              <View style={styles.splitLabels}>
                <Text style={styles.splitText}>Protein {split.protein}%</Text>
                <Text style={styles.splitText}>Karbo {split.carbs}%</Text>
                <Text style={styles.splitText}>Lemak {split.fat}%</Text>
              </View>
            </>
          ) : null}
        </Card>

        {groups.map((group) => (
          <View key={group.meal} style={{ gap: spacing.sm }}>
            <View style={styles.browseHeader}>
              <Text style={styles.sectionTitle}>
                {MEAL_LABEL[group.meal]}
                {group.entries.length > 0
                  ? `  ·  ${Math.round(group.totals.kcal)} kkal`
                  : ''}
              </Text>
            </View>

            {group.entries.length === 0 ? (
              <EmptyState
                title="Belum ada catatan"
                description={
                  nothingToCopy === group.meal
                    ? `Kemarin juga tidak ada catatan ${MEAL_LABEL[
                        group.meal
                      ].toLowerCase()}.`
                    : `Tambahkan apa yang kamu makan saat ${MEAL_LABEL[
                        group.meal
                      ].toLowerCase()}.`
                }
                action={
                  <Button
                    label="⟲ Salin dari kemarin"
                    variant="ghost"
                    loading={copyMeal.isPending}
                    onPress={() => {
                      setNothingToCopy(null);
                      copyMeal.mutate(
                        { from: yesterday, meal: group.meal },
                        {
                          onSuccess: (copied) => {
                            if (copied.length === 0) setNothingToCopy(group.meal);
                          },
                        },
                      );
                    }}
                  />
                }
              />
            ) : (
              <View style={styles.list}>
                {/*
                  Two separate targets side by side, never one inside the
                  other. A Pressable nested in a Pressable is two buttons
                  claiming the same pixels: the tap on × runs the delete AND
                  bubbles to the row, which then opens the portion sheet for
                  an entry that no longer exists.
                */}
                {group.entries.map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <Pressable
                      style={styles.rowMain}
                      accessibilityRole="button"
                      accessibilityLabel={`Ubah porsi ${entry.foodName}`}
                      onPress={() =>
                        setEditing({
                          id: entry.id,
                          name: entry.foodName,
                          quantityG: entry.quantityG,
                        })
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {entry.foodName}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {Math.round(entry.quantityG)} g · P{' '}
                          {entry.proteinG.toFixed(0)} · K {entry.carbsG.toFixed(0)} · L{' '}
                          {entry.fatG.toFixed(0)}
                        </Text>
                      </View>
                      <Text style={styles.rowKcal}>{Math.round(entry.kcal)}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Hapus ${entry.foodName}`}
                      onPress={() => deleteFood.mutate(entry.id)}
                      hitSlop={8}
                    >
                      <Text style={styles.remove}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={editing !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditing(null)}
      >
        {editing ? (
          <EditQuantitySheet
            entry={editing}
            busy={updateQuantity.isPending}
            error={updateQuantity.error}
            onSave={(quantityG) =>
              updateQuantity.mutate(
                { id: editing.id, quantityG },
                { onSuccess: () => setEditing(null) },
              )
            }
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Modal>

      <Modal
        visible={chosen !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChosen(null)}
      >
        {chosen ? (
          <PortionSheet
            day={day}
            timezone={timezone}
            food={chosen}
            onClose={() => setChosen(null)}
          />
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

/**
 * Correcting a portion after the fact.
 *
 * This existed in the API from the start and had no button anywhere, so a
 * mistyped 1500 g had to be deleted and logged again. The nutrition snapshot
 * is recomputed by the database trigger on update, so the numbers stay right.
 */
function EditQuantitySheet({
  entry,
  busy,
  error,
  onSave,
  onClose,
}: {
  entry: { id: string; name: string; quantityG: number };
  busy: boolean;
  error: unknown;
  onSave: (quantityG: number) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [amount, setAmount] = useState(String(Math.round(entry.quantityG)));

  const quantity = Number(amount);
  const valid = Number.isFinite(quantity) && quantity > 0 && quantity <= 5000;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Ubah porsi</Text>
        <Pressable onPress={onClose} accessibilityRole="button">
          <Text style={styles.link}>Tutup</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text style={styles.rowName}>{entry.name}</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={styles.input}
          accessibilityLabel="Porsi dalam gram"
          autoFocus
        />
        {error != null && <ErrorNote error={error} />}
        <Button
          label="Simpan porsi"
          onPress={() => valid && onSave(quantity)}
          disabled={!valid}
          loading={busy}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function FoodRow({
  food,
  onPress,
  styles,
  theme,
}: {
  food: Food;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={[styles.rowIcon, { backgroundColor: CATEGORY_TINT[food.category] }]}>
        <Text style={styles.tileEmoji}>{CATEGORY_EMOJI[food.category]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.rowMeta}>
          {Math.round(food.kcal)} kal / 100 {food.isLiquid ? 'ml' : 'g'}
          {food.servingLabel ? ` · ${food.servingLabel}` : ''}
        </Text>
      </View>
      <PlusIcon color={theme.brand} size={18} weight={2.2} />
    </Pressable>
  );
}

/**
 * Portion, then meal, then add.
 *
 * The meal is preselected from the clock rather than asked first: at 12:40
 * almost nobody is logging breakfast, and a wrong default costs one tap while
 * asking every time costs one tap always.
 */
function PortionSheet({
  day,
  timezone,
  food,
  onClose,
}: {
  day: string;
  timezone: string;
  food: Food;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const addFood = useAddFood(day);

  const [meal, setMeal] = useState<MealType>(() =>
    mealForHour(
      Number(
        new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          hour12: false,
          timeZone: timezone,
        }).format(new Date()),
      ),
    ),
  );
  const [amount, setAmount] = useState(String(defaultPortionG(food)));

  const quantity = Number(amount);
  const valid = Number.isFinite(quantity) && quantity > 0 && quantity <= 5000;
  const preview = valid ? nutrientsForQuantity(food, quantity) : null;
  const unit = food.isLiquid ? 'ml' : 'g';
  const quick = food.servingG
    ? [food.servingG * 0.5, food.servingG, food.servingG * 2].map(Math.round)
    : [50, 100, 200];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Berapa porsinya?</Text>
        <Pressable onPress={onClose} accessibilityRole="button">
          <Text style={styles.link}>Tutup</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={styles.foodHead}>
          <View style={[styles.rowIcon, { backgroundColor: CATEGORY_TINT[food.category] }]}>
            <Text style={styles.tileEmoji}>{CATEGORY_EMOJI[food.category]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName}>{food.name}</Text>
            {food.servingLabel && food.servingG ? (
              <Text style={styles.rowMeta}>
                {food.servingLabel} ≈ {Math.round(food.servingG)} {unit}
              </Text>
            ) : null}
          </View>
        </View>

        <Segmented options={MEAL_OPTIONS} value={meal} onChange={setMeal} />

        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={styles.input}
          accessibilityLabel={`Jumlah dalam ${unit}`}
        />

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {quick.map((value) => (
            <Button
              key={value}
              label={`${value} ${unit}`}
              variant="ghost"
              onPress={() => setAmount(String(value))}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        {preview ? (
          <View style={styles.previewBox}>
            <PreviewCell label="Kalori" value={String(Math.round(preview.kcal))} />
            <PreviewCell label="Protein" value={preview.proteinG.toFixed(1)} />
            <PreviewCell label="Karbo" value={preview.carbsG.toFixed(1)} />
            <PreviewCell label="Lemak" value={preview.fatG.toFixed(1)} />
          </View>
        ) : null}

        {addFood.error != null && <ErrorNote error={addFood.error} />}

        <Button
          label="Tambahkan"
          onPress={() =>
            valid &&
            addFood.mutate(
              { foodId: food.id, loggedOn: day, meal, quantityG: quantity },
              { onSuccess: onClose },
            )
          }
          disabled={!valid}
          loading={addFood.isPending}
          icon={<PlusIcon color={theme.onBrand} size={18} weight={2.4} />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function PreviewCell({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.rowMeta}>{label}</Text>
      <Text style={styles.rowName}>{value}</Text>
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
    title: { color: theme.text, fontSize: 22, fontWeight: '700' },
    subtitle: { color: theme.textMuted, fontSize: 13, marginTop: -spacing.sm },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 13,
      color: theme.text,
      fontSize: 15,
    },
    sectionTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
    browseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    link: { color: theme.brand, fontSize: 14, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    tile: {
      // Three per row: (100% - 2 gaps) / 3, expressed as a fraction so it
      // survives a wider phone without a media query.
      width: '30.5%',
      alignItems: 'center',
      gap: 8,
      paddingVertical: spacing.md,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.lg,
    },
    tilePressed: { opacity: 0.7 },
    tileIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileEmoji: { fontSize: 20 },
    tileLabel: {
      color: theme.text,
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
      paddingHorizontal: 4,
    },
    list: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    /**
     * A logged entry: same frame as `row`, but with no vertical padding of its
     * own. The padding moves inside `rowMain` so that the full height of the
     * row is tappable for editing rather than only the text — dead pixels
     * along the top and bottom edge of a list row feel like a broken button.
     */
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    /** Everything in a logged row except the × — the edit target. */
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowName: { color: theme.text, fontSize: 14, fontWeight: '600' },
    rowMeta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
    rowKcal: { color: theme.textMuted, fontSize: 14, fontWeight: '600' },
    remove: { color: theme.textDim, fontSize: 20, paddingHorizontal: 4 },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    total: { color: theme.text, fontSize: 24, fontWeight: '700' },
    totalTarget: { color: theme.textDim, fontSize: 13 },
    splitBar: {
      flexDirection: 'row',
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: spacing.md,
    },
    splitLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    splitText: { color: theme.textDim, fontSize: 11 },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    sheetTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
    foodHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    input: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 15,
    },
    previewBox: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
  });
