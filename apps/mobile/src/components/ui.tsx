import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radius, spacing, theme } from '../lib/theme';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? theme.bg : theme.text} />
      ) : (
        <Text style={isPrimary ? styles.buttonTextPrimary : styles.buttonTextGhost}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Progress bar. React Native has no SVG in the default runtime, so the ring
 * from the web app becomes a bar here rather than pulling in another native
 * dependency for a decorative shape.
 */
export function ProgressBar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: Math.round(max), now: Math.round(value) }}
      style={styles.progressTrack}
    >
      <View
        style={[
          styles.progressFill,
          { width: `${ratio * 100}%`, backgroundColor: over ? theme.body : color },
        ]}
      />
    </View>
  );
}

export function StatTile({
  label,
  value,
  unit,
  hint,
  accent = theme.brand,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHeader}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={styles.tileValue}>
        {value}
        {unit ? <Text style={styles.tileUnit}> {unit}</Text> : null}
      </Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{description}</Text>
    </View>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: theme.brand },
  buttonGhost: { borderWidth: 1, borderColor: theme.border },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonTextPrimary: { color: theme.bg, fontWeight: '600', fontSize: 15 },
  buttonTextGhost: { color: theme.text, fontWeight: '600', fontSize: 15 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  tile: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tileHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tileLabel: { color: theme.textDim, fontSize: 12, fontWeight: '500' },
  tileValue: { color: theme.text, fontSize: 20, fontWeight: '700', marginTop: 6 },
  tileUnit: { color: theme.textDim, fontSize: 13, fontWeight: '400' },
  tileHint: { color: theme.textDim, fontSize: 11, marginTop: 2 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: { color: theme.textMuted, fontWeight: '600' },
  emptyBody: {
    color: theme.textDim,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: 'rgba(240,122,140,0.12)',
    borderColor: 'rgba(240,122,140,0.35)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: theme.danger, fontSize: 13 },
});
