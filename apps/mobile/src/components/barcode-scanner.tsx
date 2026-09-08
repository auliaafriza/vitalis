import { isValidBarcode, normalizeBarcode } from '@calorya/core';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, spacing, useTheme, useThemedStyles, type Theme } from '../lib/theme';
import { Button, ErrorNote } from './ui';

/**
 * Barcode scanner for the mobile app.
 *
 * expo-camera does the decoding natively, so this is the one place where the
 * phone genuinely beats the web build. Manual entry is still offered: labels
 * tear, warung lighting is bad, and some packaging has no barcode at all.
 */

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export function BarcodeScanner({
  onDetected,
  onCancel,
  busy = false,
  note,
}: {
  onDetected: (barcode: string) => void;
  onCancel: () => void;
  busy?: boolean;
  note?: string | null;
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

  useEffect(() => {
    setReady(false);
    const timer = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(timer);
  }, [attempt]);

  // The camera fires this callback many times a second while the code is in
  // frame. Without the latch, one scan would enqueue a dozen lookups.
  const latched = useRef(false);

  function handleScanned({ data }: { data: string }) {
    if (latched.current || busy) return;
    const code = normalizeBarcode(data);
    if (!isValidBarcode(code)) return; // misread frame — keep scanning
    latched.current = true;
    onDetected(code);
  }

  function submitManual() {
    const code = normalizeBarcode(manual);
    if (!isValidBarcode(code)) {
      setManualError('Angka barcode tidak valid. Periksa lagi digitnya.');
      return;
    }
    setManualError(null);
    onDetected(code);
  }

  const granted = permission?.granted === true;

  return (
    <View style={styles.wrap}>
      {granted ? (
        <>
          <View style={styles.preview}>
            {ready ? (
              <CameraView
                key={attempt}
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                onBarcodeScanned={busy ? undefined : handleScanned}
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
          <Pressable
            onPress={() => {
              latched.current = false;
              setAttempt((n) => n + 1);
            }}
            accessibilityRole="button"
            style={styles.reload}
          >
            <Text style={styles.reloadText}>
              Layar kamera hitam? Ketuk untuk memuat ulang
            </Text>
          </Pressable>
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

      {note ? <Text style={styles.note}>{note}</Text> : null}

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
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: spacing.md, padding: spacing.lg },
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
      fontSize: 12,
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
      fontSize: 13,
      textAlign: 'center',
      marginTop: 4,
    },
    note: {
      color: theme.textMuted,
      fontSize: 13,
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    reload: { paddingVertical: spacing.xs, alignItems: 'center' },
    reloadText: { color: theme.textDim, fontSize: 12, textDecorationLine: 'underline' },
    label: { color: theme.textMuted, fontSize: 13, fontWeight: '500' },
    input: {
      backgroundColor: theme.bg,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 15,
    },
    actions: { flexDirection: 'row', gap: spacing.sm },
  });
