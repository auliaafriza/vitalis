import { daysInMonth, formatFullDate, MONTH_NAMES_FULL } from '@calorya/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from './ui';
import { radius, spacing, useThemedStyles, type Theme } from '../lib/theme';

/**
 * A date field that opens a picker, not a text box wanting "YYYY-MM-DD".
 *
 * Typing a birth date as a string is the worst input this app had: it asks a
 * person to know a format, offers no help if they get it wrong, and rejects
 * "12/04/1996" — which is how most people here would write it.
 *
 * Built from three scrolling columns rather than pulling in a native date
 * picker, for two reasons. One, it avoids another native module in a project
 * that has already lost days to native dependency conflicts. Two, the platform
 * pickers disagree: iOS shows a wheel, Android shows a calendar dialog, and a
 * birth date is a terrible fit for a calendar you have to page back through
 * three hundred times. Three columns get to 1996 in one flick.
 *
 * Nothing is committed until "Pilih". A picker that writes on every scroll
 * makes cancelling impossible, and cancelling is most of what a picker is for.
 */
export function DateField({
  value,
  onChange,
  minYear,
  maxYear,
  label,
  error,
}: {
  /** ISO date key, e.g. "1996-04-12". */
  value: string;
  onChange: (next: string) => void;
  minYear?: number;
  maxYear?: number;
  label?: string;
  error?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);

  const thisYear = new Date().getFullYear();
  const first = minYear ?? thisYear - 100;
  const last = maxYear ?? thisYear;

  const parsed = parseKey(value) ?? { y: thisYear - 25, m: 1, d: 1 };
  const [draft, setDraft] = useState(parsed);

  // Reopening after a cancel must show the saved value again, not the
  // half-scrolled state the last visit was abandoned in.
  useEffect(() => {
    if (open) setDraft(parseKey(value) ?? parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const years = useMemo(
    () => Array.from({ length: last - first + 1 }, (_, i) => last - i),
    [first, last],
  );
  const months = useMemo(() => MONTH_NAMES_FULL.map((name, i) => ({ name, n: i + 1 })), []);

  /*
   * The day column shrinks with the month. Without this, picking 31 January
   * and then February silently produces the 31st of a month that has 28 days
   * — which Postgres rejects at the very end, long after the mistake.
   */
  const maxDay = daysInMonth(draft.y, draft.m);
  const days = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => i + 1),
    [maxDay],
  );
  const safeDay = Math.min(draft.d, maxDay);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Tanggal'}: ${formatFullDate(value)}. Ketuk untuk mengubah.`}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
      >
        <Text style={styles.fieldText}>{formatFullDate(value)}</Text>
        <Text style={styles.chev}>▾</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label ?? 'Pilih tanggal'}</Text>
            <Text style={styles.preview}>
              {formatFullDate(toKey(draft.y, draft.m, safeDay))}
            </Text>

            <View style={styles.columns}>
              <Column
                data={days}
                selected={safeDay}
                render={(n) => String(n)}
                onSelect={(d) => setDraft((s) => ({ ...s, d }))}
                styles={styles}
                a11y="Tanggal"
              />
              <Column
                data={months.map((m) => m.n)}
                selected={draft.m}
                render={(n) => MONTH_NAMES_FULL[n - 1] ?? String(n)}
                onSelect={(m) => setDraft((s) => ({ ...s, m }))}
                styles={styles}
                wide
                a11y="Bulan"
              />
              <Column
                data={years}
                selected={draft.y}
                render={(n) => String(n)}
                onSelect={(y) => setDraft((s) => ({ ...s, y }))}
                styles={styles}
                a11y="Tahun"
              />
            </View>

            <View style={styles.actions}>
              <Button
                label="Batal"
                variant="ghost"
                onPress={() => setOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                label="Pilih"
                onPress={() => {
                  onChange(toKey(draft.y, draft.m, safeDay));
                  setOpen(false);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Column({
  data,
  selected,
  render,
  onSelect,
  styles,
  wide,
  a11y,
}: {
  data: readonly number[];
  selected: number;
  render: (n: number) => string;
  onSelect: (n: number) => void;
  styles: ReturnType<typeof makeStyles>;
  wide?: boolean;
  a11y: string;
}) {
  const ref = useRef<ScrollView>(null);
  const index = data.indexOf(selected);

  // Open on the current value rather than at the top. A year column that
  // starts at 2026 when the answer is 1996 is thirty flicks of nothing.
  useEffect(() => {
    if (index > 1) {
      const t = setTimeout(
        () => ref.current?.scrollTo({ y: (index - 1) * ROW, animated: false }),
        0,
      );
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView
      ref={ref}
      style={[styles.column, wide && styles.columnWide]}
      showsVerticalScrollIndicator={false}
      accessibilityLabel={a11y}
    >
      {data.map((n) => {
        const active = n === selected;
        return (
          <Pressable
            key={n}
            onPress={() => onSelect(n)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.row, active && styles.rowActive]}
          >
            <Text style={[styles.rowText, active && styles.rowTextActive]}>
              {render(n)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const ROW = 44;

function parseKey(key: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function toKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    label: { color: theme.textMuted, fontSize: 15, fontWeight: '600', marginBottom: 6 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 13,
    },
    fieldPressed: { opacity: 0.7 },
    fieldText: { color: theme.text, fontSize: 17 },
    chev: { color: theme.textDim, fontSize: 15 },
    error: { color: theme.danger, fontSize: 14, marginTop: 6 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    sheet: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    sheetTitle: { color: theme.textMuted, fontSize: 15, fontWeight: '600' },
    preview: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '700',
      marginTop: 4,
      marginBottom: spacing.md,
    },
    columns: { flexDirection: 'row', gap: spacing.sm, height: ROW * 5 },
    column: {
      flex: 1,
      backgroundColor: theme.bg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    columnWide: { flex: 1.6 },
    row: { height: ROW, alignItems: 'center', justifyContent: 'center' },
    rowActive: { backgroundColor: theme.brandSoft },
    rowText: { color: theme.textMuted, fontSize: 17 },
    rowTextActive: { color: theme.brand, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  });
