import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { EyeIcon, EyeOffIcon } from './icons';
import {
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '../lib/theme';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  if (!action) return <Text style={styles.sectionTitle}>{children}</Text>;
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isDanger
          ? styles.buttonDanger
          : isPrimary
            ? styles.buttonPrimary
            : styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary || isDanger ? theme.onBrand : theme.text} />
      ) : (
        <>
          {icon}
          <Text
            style={
              isPrimary || isDanger ? styles.buttonTextPrimary : styles.buttonTextGhost
            }
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * A yes/no question the user must answer before something irreversible happens.
 *
 * A real Modal rather than `Alert.alert`, for three reasons that all bit us:
 *   - Alert's button list is not implemented on React Native Web, so on the
 *     web build the dialog appeared with no way to confirm — the action simply
 *     never ran and the button looked dead;
 *   - Alert cannot show a pending state, so a slow sign-out looked frozen;
 *   - Alert cannot show the error when the action fails, which is how a
 *     failure turns into "the button does nothing".
 *
 * `busy` keeps the sheet open and the buttons disabled while the work runs, so
 * the answer is never collected twice, and `error` is rendered in place.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android's back button must answer "no", never "yes" — but not while
      // the action is already running, or the sheet would vanish mid-flight.
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View style={styles.confirmBackdrop}>
        <View style={styles.confirmSheet}>
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmBody}>{message}</Text>

          {error != null && <ErrorNote error={error} />}

          <View style={styles.confirmActions}>
            <Button
              label={cancelLabel}
              variant="ghost"
              disabled={busy}
              onPress={onCancel}
              style={{ flex: 1 }}
            />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              loading={busy}
              onPress={onConfirm}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * The calorie ring.
 *
 * Drawn with SVG rather than the two-rotated-half-circles View trick: the View
 * version has to know the colour behind it to mask the remaining arc, which
 * quietly breaks the moment the ring is placed on anything but a flat card —
 * and it breaks in a way that only shows up on one theme.
 *
 * The arc starts at twelve o'clock because that is where people expect a dial
 * to start; SVG starts at three, hence the -90° rotation.
 */
export function Ring({
  size = 168,
  stroke = 14,
  progress,
  color,
  trackColor,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  color: string;
  trackColor?: string;
  children?: ReactNode;
}) {
  const { theme } = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor ?? theme.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

export function ProgressBar({
  value,
  max,
  color,
  label,
  height = 6,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  height?: number;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: Math.round(max), now: Math.round(value) }}
      style={[styles.progressTrack, { height, borderRadius: height / 2 , marginBottom: 10}]}
    >
      <View
        style={{
          height: '100%',
          borderRadius: height / 2,
          width: `${ratio * 100}%`,
          backgroundColor: over ? theme.body : color,
        }}
      />
    </View>
  );
}

/** One macro under the ring: name, bar, "150 / 250g". */
export function MacroBar({
  label,
  value,
  target,
  color,
  unit = 'g',
}: {
  label: string;
  value: number;
  target: number;
  color: string;
  unit?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.macro}>
      <Text style={styles.macroLabel}>{label}</Text>
      <ProgressBar value={value} max={target} color={color} label={label} height={5} />
      <Text style={styles.macroValue}>
        {Math.round(value)}
        <Text style={styles.macroTarget}>
          {' '}
          / {Math.round(target)}
          {unit}
        </Text>
      </Text>
    </View>
  );
}

/** The pill row on Progress: Kalori · Berat Badan · Nutrisi. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatTile({
  label,
  value,
  unit,
  hint,
  accent,
  onPress,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: string;
  /** When given the whole tile becomes a button — used to open the editor. */
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const Container = onPress ? Pressable : View;
  return (
    <Container
      {...(onPress
        ? {
            onPress,
            accessibilityRole: 'button' as const,
            accessibilityLabel: `${label}: ${value}. Ketuk untuk mengubah.`,
          }
        : {})}
      style={styles.tile}
    >
      <View style={styles.tileHeader}>
        <View style={[styles.dot, { backgroundColor: accent ?? theme.brand }]} />
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={styles.tileValue}>
        {value}
        {unit ? <Text style={styles.tileUnit}> {unit}</Text> : null}
      </Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </Container>
  );
}

/**
 * Password field with a show/hide toggle.
 *
 * Visibility always starts hidden on mount — revealing a password is a
 * deliberate act and should not be remembered between screens.
 *
 * autoCorrect / spellCheck are off because Android can attach the keyboard
 * suggestion strip to a field once secureTextEntry is flipped off, which
 * would offer to "learn" the password.
 *
 * The eye is an SVG icon rather than the 👁 emoji it used to be: an emoji
 * takes the platform's own glyph and colour, so it stayed dark on the dark
 * theme and looked like a different app on iOS than on Android.
 */
export function PasswordInput({
  value,
  onChangeText,
  placeholder = 'Minimal 8 karakter',
  autoComplete = 'current-password',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoComplete?: 'current-password' | 'new-password';
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.passwordWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoComplete={autoComplete}
        autoCorrect={false}
        spellCheck={false}
        placeholder={placeholder}
        placeholderTextColor={theme.textDim}
        style={styles.passwordInput}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: visible }}
        accessibilityLabel={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        style={styles.passwordToggle}
      >
        {visible ? (
          <EyeOffIcon color={theme.textMuted} size={20} weight={1.8} />
        ) : (
          <EyeIcon color={theme.textMuted} size={20} weight={1.8} />
        )}
      </Pressable>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  /** An offer that belongs with the emptiness, e.g. "salin dari kemarin". */
  action?: ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{description}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const styles = useThemedStyles(makeStyles);
  const message =
    error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/**
 * A grey block standing in for content that has not arrived yet.
 *
 * The phone had nothing like this: every screen rendered its final layout
 * immediately with zeros and empty lists in it, then snapped to the real
 * numbers when Supabase answered. On a good connection that is a flicker; on
 * a bad one it is a dashboard that confidently says you have eaten 0 kcal and
 * an empty food list that reads as "your entries are gone".
 *
 * A skeleton says the honest thing instead — "this is coming" — and it says it
 * in the shape of what is coming, so the layout does not jump when it lands.
 *
 * The pulse uses the native driver so it keeps animating on the UI thread
 * while JavaScript is busy parsing the response that ends it.
 */
export function Skeleton({
  height = 16,
  width,
  radius: r = radius.md,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height,
          width: width ?? '100%',
          borderRadius: r,
          backgroundColor: theme.border,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }),
        },
        style,
      ]}
    />
  );
}

/**
 * A card-shaped skeleton: a title line and a few body lines.
 *
 * Most loading states on this app are "a Card whose contents are not here
 * yet", so that shape is worth having once rather than rebuilt per screen.
 */
export function SkeletonCard({
  lines = 3,
  title = true,
}: {
  lines?: number;
  title?: boolean;
}) {
  return (
    <Card>
      {title ? <Skeleton height={14} width="45%" /> : null}
      <View style={{ gap: spacing.sm, marginTop: title ? spacing.md : 0 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            height={12}
            // The last line stops short, the way a real paragraph does.
            width={i === lines - 1 ? '60%' : '100%'}
          />
        ))}
      </View>
    </Card>
  );
}

/**
 * "Something is loading, but the screen is already drawn."
 *
 * For a refresh of data that is already visible — switching to another day, a
 * background refetch — where a skeleton would be wrong because it would blank
 * out content the user can still read.
 */
export function InlineLoading({ label = 'Memuat…' }: { label?: string }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View accessibilityRole="progressbar" style={styles.inlineLoading}>
      <ActivityIndicator size="small" color={theme.textDim} />
      <Text style={styles.inlineLoadingText}>{label}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.xl,
      padding: spacing.lg,
      // Elevation is theme-dependent: on the dark palette shadowOpacity is 0
      // and the border does the separating instead.
      shadowColor: '#16241c',
      shadowOpacity: theme.shadowOpacity,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: theme.shadowOpacity > 0 ? 2 : 0,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    sectionTitle: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: spacing.md,
    },
    button: {
      flexDirection: 'row',
      gap: spacing.sm,
      borderRadius: radius.lg,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonPrimary: { backgroundColor: theme.brand },
    buttonGhost: { borderWidth: 1, borderColor: theme.border },
    buttonDanger: { backgroundColor: theme.danger },
    confirmBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    confirmSheet: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    confirmTitle: { color: theme.text, fontSize: 18, fontWeight: '700' },
    confirmBody: { color: theme.textMuted, fontSize: 15, lineHeight: 21 },
    confirmActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    buttonDisabled: { opacity: 0.5 },
    buttonPressed: { opacity: 0.85 },
    buttonTextPrimary: { color: theme.onBrand, fontWeight: '700', fontSize: 16 },
    buttonTextGhost: { color: theme.text, fontWeight: '600', fontSize: 16 },
    progressTrack: {
      backgroundColor: theme.surfaceAlt,
      overflow: 'hidden',
      width: '100%',
    },
    macro: { flex: 1, gap: 6 },
    macroLabel: { color: theme.textDim, fontSize: 12, fontWeight: '600' },
    macroValue: { color: theme.text, fontSize: 13, fontWeight: '700' },
    macroTarget: { color: theme.textDim, fontWeight: '400' },
    segmented: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: theme.surfaceAlt,
      borderRadius: radius.pill,
      padding: 4,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: radius.pill,
      alignItems: 'center',
    },
    segmentActive: { backgroundColor: theme.surface },
    segmentText: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
    segmentTextActive: { color: theme.text },
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
    tileLabel: { color: theme.textDim, fontSize: 13, fontWeight: '500' },
    tileValue: { color: theme.text, fontSize: 22, fontWeight: '700', marginTop: 6 },
    tileUnit: { color: theme.textDim, fontSize: 14, fontWeight: '400' },
    tileHint: { color: theme.textDim, fontSize: 12, marginTop: 2 },
    empty: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.border,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
    },
    emptyTitle: { color: theme.textMuted, fontWeight: '600' },
    emptyAction: { marginTop: spacing.md, alignSelf: 'stretch' },
    emptyBody: {
      color: theme.textDim,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 4,
    },
    passwordWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingRight: spacing.md,
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 16,
    },
    passwordToggle: { padding: 4 },
    errorBox: {
      backgroundColor: theme.brandSoft,
      borderColor: theme.danger,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    errorText: { color: theme.danger, fontSize: 14 },
    inlineLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    inlineLoadingText: { color: theme.textDim, fontSize: 13 },
  });
