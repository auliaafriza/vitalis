import { isValidBarcode, normalizeBarcode } from '@calorya/core';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
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
import { radius, spacing, useTheme, useThemedStyles, type Theme } from '../lib/theme';
import { Button, ErrorNote } from './ui';

/**
 * Barcode scanner for the mobile app.
 *
 * expo-camera does the decoding natively, so this is the one place where the
 * phone genuinely beats the web build. Manual entry is still offered: labels
 * tear, warung lighting is bad, and some packaging has no barcode at all.
 */

/**
 * What the camera will try to decode.
 *
 * The original four cover imported packaged goods and nothing else. Plenty of
 * Indonesian products — anything printed by a local converter, and most
 * warung-scale packaging — carry Code 128 or ITF-14 instead, and a scanner
 * that is not told to look for them simply never sees them. Each extra type
 * costs a little decode time and nothing else, so the useful ones are all
 * listed rather than a minimal set.
 */
const BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
] as const;

export function BarcodeScanner({
  onDetected,
  onCancel,
  busy = false,
  note,
  onManualEntry,
}: {
  onDetected: (barcode: string) => void;
  onCancel: () => void;
  busy?: boolean;
  note?: string | null;
  /**
   * Give up on the databases and type the product in by hand, keeping the
   * barcode. Offered as soon as a lookup comes back empty — telling someone
   * "this product is in no database" and then showing them the same camera
   * again is a dead end, and it was the one this screen had.
   */
  onManualEntry?: (barcode: string | null) => void;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  /**
   * Mounting CameraView while the screen is still animating in can leave the
   * native preview surface unattached — the camera then shows black forever.
   * A short delay lets layout settle first; `attempt` lets the user force a
   * remount if it still happens, which beats making them restart the app.
   */
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /**
   * Warung lighting is bad and freezer packaging is reflective; a torch is the
   * difference between a code that reads and one that does not.
   */
  const [torch, setTorch] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(timer);
  }, [attempt]);

  // The camera fires this callback many times a second while the code is in
  // frame. Without the latch, one scan would enqueue a dozen lookups.
  const latched = useRef(false);

  /**
   * The last code we actually looked up, however it arrived.
   *
   * Needed because "add it manually" has to carry the barcode with it, and a
   * scanned code never touches the text field — reading `manual` there would
   * hand the form an empty string and lose the number the user just pointed
   * their camera at.
   */
  const [lastCode, setLastCode] = useState<string | null>(null);

  function handleScanned({ data }: { data: string }) {
    if (latched.current || busy) return;
    const code = normalizeBarcode(data);
    if (!isValidBarcode(code)) return; // misread frame — keep scanning
    latched.current = true;
    setLastCode(code);
    onDetected(code);
  }

  function submitManual() {
    const code = normalizeBarcode(manual);
    if (!isValidBarcode(code)) {
      setManualError('Angka barcode tidak valid. Periksa lagi digitnya.');
      return;
    }
    setManualError(null);
    setLastCode(code);
    onDetected(code);
  }

  const granted = permission?.granted === true;

  return (
    /*
     * The keyboard used to sit on top of the field it was opened for.
     *
     * The manual-entry input is the last thing on this screen, so on any
     * ordinary phone the software keyboard covers it completely: you tap the
     * box, it disappears, and you type digits you cannot see — and the "Cari"
     * button underneath is out of reach too. A plain <View> cannot resize for
     * a keyboard, so the content has to live in a scroll view that a
     * KeyboardAvoidingView can shrink.
     *
     * `behavior` differs by platform on purpose: iOS needs padding added
     * beneath the content, whereas Android's windowSoftInputMode already
     * resizes the window and 'height' cooperates with that instead of
     * fighting it.
     */
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      {granted ? (
        <>
          <View style={styles.preview}>
            {ready ? (
              <CameraView
                key={attempt}
                style={StyleSheet.absoluteFill}
                facing="back"
                /*
                 * Barcodes are small and close, and a fixed-focus preview
                 * simply will not resolve the bars. This is the single most
                 * common reason a scan "does not read".
                 */
                autofocus="on"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                /*
                 * Always attached, never swapped for undefined.
                 *
                 * Passing `undefined` while a lookup is in flight tears the
                 * native scanner down, and it does not always come back when
                 * the prop returns — the preview keeps running and no code is
                 * ever decoded again. The busy check belongs inside the
                 * handler, where it costs nothing.
                 */
                onBarcodeScanned={handleScanned}
              />
            ) : null}
            <View pointerEvents="none" style={styles.reticle} />
            <Text style={styles.hint}>
              {!ready
                ? 'Menyiapkan kamera…'
                : busy
                  ? 'Mencari produk…'
                  : 'Arahkan ke barcode kemasan'}
            </Text>
          </View>
          <View style={styles.cameraTools}>
            <Pressable
              onPress={() => setTorch((on) => !on)}
              accessibilityRole="switch"
              accessibilityState={{ checked: torch }}
              accessibilityLabel="Lampu senter kamera"
              style={[styles.tool, torch && styles.toolActive]}
            >
              <Text style={[styles.toolText, torch && styles.toolTextActive]}>
                {torch ? 'Senter menyala' : 'Nyalakan senter'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                latched.current = false;
                setAttempt((n) => n + 1);
              }}
              accessibilityRole="button"
              style={styles.tool}
            >
              <Text style={styles.toolText}>Muat ulang kamera</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>
            {permission?.canAskAgain === false
              ? 'Izin kamera ditolak permanen'
              : 'Butuh izin kamera'}
          </Text>
          <Text style={styles.placeholderBody}>
            {permission?.canAskAgain === false
              ? 'Aktifkan kamera untuk Calorya di Pengaturan, atau ketik angkanya di bawah.'
              : 'Kamera hanya dipakai untuk membaca barcode, tidak ada gambar yang disimpan.'}
          </Text>
          {permission?.canAskAgain !== false && (
            <Button
              label="Izinkan kamera"
              onPress={() => void requestPermission()}
              style={{ marginTop: spacing.md }}
            />
          )}
        </View>
      )}

      {note ? (
        <View style={styles.noteBox}>
          <Text style={styles.note}>{note}</Text>
          {onManualEntry ? (
            <Button
              label="Tambah manual"
              variant="ghost"
              onPress={() => onManualEntry(lastCode)}
              style={{ marginTop: spacing.md }}
            />
          ) : null}
        </View>
      ) : null}

      <Text style={styles.label}>Atau ketik angka barcode</Text>
      <TextInput
        value={manual}
        onChangeText={(v) => {
          setManual(v);
          setManualError(null);
        }}
        keyboardType="number-pad"
        placeholder="8998866200189"
        placeholderTextColor={theme.textDim}
        style={styles.input}
        accessibilityLabel="Angka barcode"
      />
      {manualError ? <ErrorNote error={new Error(manualError)} /> : null}

      <View style={styles.actions}>
        <Button label="Batal" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button
          label={busy ? 'Mencari…' : 'Cari'}
          onPress={submitManual}
          loading={busy}
          disabled={manual.trim().length === 0}
          style={{ flex: 1 }}
        />
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    // A contentContainerStyle now, not a flex container: `flexGrow` lets it
    // fill a short screen while still scrolling when the keyboard is up.
    wrap: { gap: spacing.md, padding: spacing.lg, flexGrow: 1 },
    preview: {
      height: 240,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: '#000',
      justifyContent: 'flex-end',
    },
    reticle: {
      position: 'absolute',
      left: 32,
      right: 32,
      top: '50%',
      height: 96,
      marginTop: -48,
      borderWidth: 2,
      borderColor: theme.brand,
      borderRadius: radius.md,
    },
    hint: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
      textAlign: 'center',
      paddingBottom: spacing.sm,
    },
    placeholder: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.border,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
    },
    placeholderTitle: { color: theme.textMuted, fontWeight: '600' },
    placeholderBody: {
      color: theme.textDim,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 4,
    },
    noteBox: {
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    note: { color: theme.textMuted, fontSize: 14, lineHeight: 20 },
    cameraTools: { flexDirection: 'row', gap: spacing.sm },
    tool: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    toolActive: { borderColor: theme.brand, backgroundColor: theme.surface },
    toolText: { color: theme.textDim, fontSize: 13 },
    toolTextActive: { color: theme.brand, fontWeight: '600' },
    label: { color: theme.textMuted, fontSize: 14, fontWeight: '500' },
    input: {
      backgroundColor: theme.bg,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 16,
    },
    actions: { flexDirection: 'row', gap: spacing.sm },
  });
