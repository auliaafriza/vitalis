import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatVolume, waterEntrySchema } from '@calorya/core';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAddWater } from '../lib/hooks';
import { radius, spacing, useTheme, useThemedStyles, type Theme } from '../lib/theme';
import { Button, ErrorNote } from './ui';

/**
 * Logging a glass of water: the usual sizes, plus any amount at all.
 *
 * The fixed buttons cover the common cases and nothing else, which is fine
 * until your bottle is 600 ml, or the warung glass is 180, or you finished
 * half a litre and want to log 250. Before this there was no way to say so —
 * the only options were to log the wrong number or not log it.
 *
 * It also exists in one place rather than four. This row was copy-pasted onto
 * the dashboard and the health screen on both platforms, with three different
 * lists of amounts between them; adding a custom field to each copy would have
 * made four chances to get it subtly different.
 */

/** The default sizes: a small glass, a big glass, a mug, a small bottle. */
export const QUICK_WATER_ML = [150, 250, 350, 500] as const;

/**
 * Where the last custom amount is remembered.
 *
 * A custom option that has to be retyped every single day is a chore, not a
 * feature — someone with a 600 ml bottle drinks from it several times a day.
 * Remembering the last one and offering it as an ordinary button turns the
 * second use onwards back into one tap.
 */
const LAST_CUSTOM_KEY = 'calorya.water.custom.v1';

export function WaterQuickAdd({
  day,
  amounts = QUICK_WATER_ML,
}: {
  day: string;
  amounts?: readonly number[];
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const addWater = useAddWater(day);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(LAST_CUSTOM_KEY)
      .then((raw) => {
        if (!alive || raw === null) return;
        const value = Number(raw);
        // Anything unparseable is simply ignored: a remembered shortcut is a
        // convenience, and a broken one must not stop the rest of the card.
        if (Number.isInteger(value) && value > 0) setRemembered(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function log(amountMl: number) {
    addWater.mutate({ loggedOn: day, amountMl });
  }

  function submitCustom() {
    const parsed = waterEntrySchema.shape.amountMl.safeParse(draft.trim());
    if (!parsed.success) {
      // The schema owns the wording ("Sekali catat maksimal 3000 ml"), so the
      // limit is stated once and cannot drift from what the database accepts.
      setInvalid(parsed.error.issues[0]?.message ?? 'Jumlah tidak valid');
      return;
    }

    const amountMl = parsed.data;
    setInvalid(null);
    log(amountMl);
    setDraft('');
    setOpen(false);

    if (!amounts.includes(amountMl)) {
      setRemembered(amountMl);
      void AsyncStorage.setItem(LAST_CUSTOM_KEY, String(amountMl)).catch(() => {});
    }
  }

  // Only worth showing when it is not already one of the fixed buttons.
  const showRemembered = remembered !== null && !amounts.includes(remembered);
  const busy = (ml: number) =>
    addWater.isPending && addWater.variables?.amountMl === ml;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.row}>
        {amounts.map((ml) => (
          <Button
            key={ml}
            label={`+${ml}`}
            variant="ghost"
            // Only the tapped one spins; a row of dimmed buttons with no
            // spinner is indistinguishable from a row of broken ones.
            loading={busy(ml)}
            disabled={addWater.isPending}
            onPress={() => log(ml)}
            style={{ flex: 1 }}
          />
        ))}
      </View>

      <View style={styles.row}>
        {showRemembered ? (
          <Button
            label={`+${remembered}`}
            variant="ghost"
            loading={busy(remembered)}
            disabled={addWater.isPending}
            onPress={() => log(remembered)}
            style={{ flex: 1 }}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => {
            setOpen((was) => !was);
            setInvalid(null);
          }}
          style={[styles.otherButton, open && styles.otherButtonOpen]}
        >
          <Text style={[styles.otherText, open && styles.otherTextOpen]}>
            {open ? 'Tutup' : 'Jumlah lain…'}
          </Text>
        </Pressable>
      </View>

      {open ? (
        <View style={styles.customRow}>
          <View style={styles.inputWrap}>
            <TextInput
              value={draft}
              onChangeText={(value) => {
                setDraft(value);
                setInvalid(null);
              }}
              keyboardType="number-pad"
              placeholder="600"
              placeholderTextColor={theme.textDim}
              style={styles.input}
              accessibilityLabel="Jumlah air dalam mililiter"
              returnKeyType="done"
              onSubmitEditing={submitCustom}
              autoFocus
            />
            <Text style={styles.unit}>ml</Text>
          </View>
          <Button
            label="Catat"
            onPress={submitCustom}
            loading={addWater.isPending && !amounts.includes(Number(draft))}
            disabled={draft.trim().length === 0}
          />
        </View>
      ) : null}

      {invalid ? <Text style={styles.invalid}>{invalid}</Text> : null}
      {addWater.error != null ? <ErrorNote error={addWater.error} /> : null}

      {showRemembered && !open ? (
        <Text style={styles.hint}>
          {formatVolume(remembered)} disimpan dari catatan terakhirmu.
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.sm },
    otherButton: {
      flex: 1,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    otherButtonOpen: { borderStyle: 'solid', borderColor: theme.water },
    otherText: { color: theme.textDim, fontSize: 15, fontWeight: '500' },
    otherTextOpen: { color: theme.water, fontWeight: '600' },
    customRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    inputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      backgroundColor: theme.surface,
    },
    input: { flex: 1, paddingVertical: 11, color: theme.text, fontSize: 16 },
    unit: { color: theme.textDim, fontSize: 13 },
    invalid: { color: theme.danger, fontSize: 13 },
    hint: { color: theme.textDim, fontSize: 13 },
  });
