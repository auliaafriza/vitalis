import { groupByMeal } from '@calorya/api';
import {
  defaultPortionG,
  formatKcal,
  macroSplit,
  MEAL_EMOJI,
  MEAL_LABEL,
  nutrientsForQuantity,
  sumNutrients,
  todayKey,
  type Food,
  type MealType,
} from '@calorya/core';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  ProgressBar,
} from '../../src/components/ui';
import {
  useAddFood,
  useDeleteFood,
  useFoodEntries,
  useFoodSearch,
  useProfile,
  useRecentFoods,
  useResolveBarcode,
  useTargets,
} from '../../src/lib/hooks';
import { BarcodeScanner } from '../../src/components/barcode-scanner';
import { radius, spacing, theme } from '../../src/lib/theme';

export default function NutritionScreen() {
  const { data: profile } = useProfile();
  const timezone =
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jakarta';
  const day = todayKey(timezone);

  const { data: entries, error } = useFoodEntries(day);
  const { data: targets } = useTargets(day);
  const deleteFood = useDeleteFood(day);
  const [picking, setPicking] = useState<MealType | null>(null);

  const groups = useMemo(() => groupByMeal(entries ?? []), [entries]);
  const totals = useMemo(() => sumNutrients(entries ?? []), [entries]);
  const split = useMemo(() => macroSplit(totals), [totals]);

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorNote error={error} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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
            <View style={styles.mealHeader}>
              <Text style={styles.mealTitle}>
                {MEAL_EMOJI[group.meal]} {MEAL_LABEL[group.meal]}
                {group.entries.length > 0
                  ? `  ·  ${Math.round(group.totals.kcal)} kkal`
                  : ''}
              </Text>
              <Pressable onPress={() => setPicking(group.meal)} accessibilityRole="button">
                <Text style={styles.addLink}>+ Tambah</Text>
              </Pressable>
            </View>

            {group.entries.length === 0 ? (
              <EmptyState
                title="Belum ada catatan"
                description={`Tambahkan apa yang kamu makan saat ${MEAL_LABEL[
                  group.meal
                ].toLowerCase()}.`}
              />
            ) : (
              <View style={styles.entryList}>
                {group.entries.map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryName} numberOfLines={1}>
                        {entry.foodName}
                      </Text>
                      <Text style={styles.entryMeta}>
                        {Math.round(entry.quantityG)} g · P {entry.proteinG.toFixed(0)} · K{' '}
                        {entry.carbsG.toFixed(0)} · L {entry.fatG.toFixed(0)}
                      </Text>
                    </View>
                    <Text style={styles.entryKcal}>{Math.round(entry.kcal)}</Text>
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
        visible={picking !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPicking(null)}
      >
        {picking ? (
          <FoodPickerSheet day={day} meal={picking} onClose={() => setPicking(null)} />
        ) : null}
      </Modal>
    </>
  );
}

function FoodPickerSheet({
  day,
  meal,
  onClose,
}: {
  day: string;
  meal: MealType;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const { data: results } = useFoodSearch(query);
  const { data: recent } = useRecentFoods();
  const addFood = useAddFood(day);
  const resolve = useResolveBarcode();

  function handleBarcode(barcode: string) {
    setScanNote(null);
    resolve.mutate(barcode, {
      onSuccess: (result) => {
        if (result.status === 'catalogue' || result.status === 'imported') {
          setScanning(false);
          setSelected(result.food);
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

  const list = query.trim().length === 0 && recent?.length ? recent : (results ?? []);

  return (
    <SafeAreaView style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>
          {selected
            ? 'Berapa porsinya?'
            : scanning
              ? 'Pindai barcode'
              : `Tambah ke ${MEAL_LABEL[meal]}`}
        </Text>
        <Pressable
          onPress={
            selected
              ? () => setSelected(null)
              : scanning
                ? () => setScanning(false)
                : onClose
          }
        >
          <Text style={styles.addLink}>
            {selected || scanning ? 'Kembali' : 'Tutup'}
          </Text>
        </Pressable>
      </View>

      {scanning && !selected ? (
        <BarcodeScanner
          onDetected={handleBarcode}
          onCancel={() => setScanning(false)}
          busy={resolve.isPending}
          note={scanNote}
        />
      ) : selected ? (
        <PortionStep
          food={selected}
          busy={addFood.isPending}
          error={addFood.error}
          onSubmit={(quantityG) =>
            addFood.mutate(
              { foodId: selected.id, loggedOn: day, meal, quantityG },
              { onSuccess: onClose },
            )
          }
        />
      ) : (
        <>
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cari makanan… (mis. nasi, tempe)"
              placeholderTextColor={theme.textDim}
              style={[styles.input, { flex: 1 }]}
              autoFocus
            />
            <Pressable
              onPress={() => setScanning(true)}
              accessibilityRole="button"
              accessibilityLabel="Pindai barcode"
              style={styles.scanButton}
            >
              <Text style={{ fontSize: 18 }}>▥</Text>
            </Pressable>
          </View>
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            ListEmptyComponent={
              <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
                <Text style={styles.entryMeta}>Tidak ada hasil untuk “{query}”.</Text>
                <Text style={[styles.entryMeta, { textAlign: 'center' }]}>
                  Kalau ini produk kemasan, barcode-nya biasanya lebih cepat
                  ketemu daripada namanya.
                </Text>
                <Button
                  label="Pindai barcode"
                  onPress={() => setScanning(true)}
                  style={{ marginTop: spacing.md, alignSelf: 'stretch' }}
                />
              </View>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.resultRow} onPress={() => setSelected(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName}>{item.name}</Text>
                  <Text style={styles.entryMeta}>
                    {Math.round(item.kcal)} kkal / 100 {item.isLiquid ? 'ml' : 'g'}
                    {item.servingLabel ? ` · ${item.servingLabel}` : ''}
                  </Text>
                </View>
                <Text style={styles.addLink}>+</Text>
              </Pressable>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function PortionStep({
  food,
  busy,
  error,
  onSubmit,
}: {
  food: Food;
  busy: boolean;
  error: unknown;
  onSubmit: (quantityG: number) => void;
}) {
  const [amount, setAmount] = useState(String(defaultPortionG(food)));
  const quantity = Number(amount);
  const valid = Number.isFinite(quantity) && quantity > 0 && quantity <= 5000;
  const preview = valid ? nutrientsForQuantity(food, quantity) : null;
  const unit = food.isLiquid ? 'ml' : 'g';
  const quick = food.servingG
    ? [food.servingG * 0.5, food.servingG, food.servingG * 2].map(Math.round)
    : [50, 100, 200];

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={styles.entryName}>{food.name}</Text>
      {food.servingLabel && food.servingG ? (
        <Text style={styles.entryMeta}>
          {food.servingLabel} ≈ {Math.round(food.servingG)} {unit}
        </Text>
      ) : null}

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

      {error != null && <ErrorNote error={error} />}

      <Button
        label="Tambahkan"
        onPress={() => valid && onSubmit(quantity)}
        disabled={!valid}
        loading={busy}
      />
    </ScrollView>
  );
}

function PreviewCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.entryMeta}>{label}</Text>
      <Text style={styles.entryName}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.md },
  total: { color: theme.text, fontSize: 24, fontWeight: '700' },
  totalTarget: { color: theme.textDim, fontSize: 13 },
  splitBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  splitLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  splitText: { color: theme.textDim, fontSize: 11 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealTitle: { color: theme.textMuted, fontSize: 13, fontWeight: '600' },
  addLink: { color: theme.brand, fontSize: 14, fontWeight: '600' },
  entryList: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: theme.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  entryName: { color: theme.text, fontSize: 14, fontWeight: '600' },
  entryMeta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  entryKcal: { color: theme.textMuted, fontSize: 14 },
  remove: { color: theme.textDim, fontSize: 20, paddingHorizontal: 4 },
  sheet: { flex: 1, backgroundColor: theme.bg },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sheetTitle: { color: theme.text, fontSize: 16, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    margin: spacing.lg,
  },
  scanButton: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
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
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
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
