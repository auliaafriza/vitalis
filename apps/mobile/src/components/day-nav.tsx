import { addDays, relativeDayLabel } from '@calorya/core';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { DatePickerModal } from './date-field';
import { radius, spacing, useTheme, useThemedStyles, type Theme } from '../lib/theme';

/**
 * Which day a screen is showing, and how to get to another one.
 *
 * Three ways to move, because they answer different questions:
 *
 *   - The arrows are for "yesterday", which is most of it.
 *   - Tapping the label opens the date picker, for the Tuesday two weeks ago
 *     you forgot to log. Stepping back fourteen times to reach it is not a
 *     feature, it is a punishment.
 *   - "Hari ini" appears only when you are not on today, as the way back.
 *
 * Forward is capped at today throughout. There is nothing to show for
 * tomorrow, and letting someone log a meal into the future quietly corrupts
 * the streak and the averages.
 */
export function DayNav({
  selected,
  today,
  onChange,
}: {
  selected: string;
  today: string;
  onChange: (day: string) => void;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [picking, setPicking] = useState(false);

  const canGoForward = selected < today;
  const isToday = selected === today;
  const year = Number(today.slice(0, 4));

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hari sebelumnya"
        onPress={() => onChange(addDays(selected, -1))}
        hitSlop={10}
        style={styles.arrow}
      >
        <ChevronLeftIcon color={theme.textDim} size={20} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${relativeDayLabel(selected, today)}. Ketuk untuk pilih tanggal lain.`}
        onPress={() => setPicking(true)}
        style={styles.label}
      >
        <CalendarIcon color={theme.textDim} size={15} weight={1.8} />
        <Text style={styles.labelText} numberOfLines={1}>
          {relativeDayLabel(selected, today)}
        </Text>
        <Text style={styles.chev}>▾</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hari berikutnya"
        accessibilityState={{ disabled: !canGoForward }}
        disabled={!canGoForward}
        onPress={() => onChange(addDays(selected, 1))}
        hitSlop={10}
        style={styles.arrow}
      >
        <ChevronRightIcon
          color={canGoForward ? theme.textDim : theme.border}
          size={20}
        />
      </Pressable>

      {/*
        Only while it is useful. A "Hari ini" button that is always there is
        one more thing to read on the screen you are already on.
      */}
      {!isToday ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(today)}
          style={styles.todayButton}
        >
          <Text style={styles.todayText}>Hari ini</Text>
        </Pressable>
      ) : null}

      <DatePickerModal
        visible={picking}
        value={selected}
        title="Pilih tanggal"
        // A year either side covers "last December" without offering a date
        // picker that can scroll into next year.
        minYear={year - 2}
        maxYear={year}
        // The columns stop at today, so there is no future date to offer and
        // none to quietly correct afterwards.
        maxDate={today}
        onCancel={() => setPicking(false)}
        onPick={(next) => {
          setPicking(false);
          onChange(next > today ? today : next);
        }}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    arrow: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
    label: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: theme.surfaceAlt,
    },
    labelText: { color: theme.text, fontSize: 15, fontWeight: '600' },
    chev: { color: theme.textDim, fontSize: 12 },
    todayButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    todayText: { color: theme.brand, fontSize: 13, fontWeight: '600' },
  });
