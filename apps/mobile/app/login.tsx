import { credentialsSchema } from '@vitalis/core';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorNote } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { radius, spacing, theme } from '../src/lib/theme';

export default function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setNotice(null);

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0]?.message ?? 'Data tidak valid'));
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp(parsed.data);
        if (signUpError) throw signUpError;
        setNotice('Akun dibuat. Cek email jika konfirmasi diaktifkan, lalu masuk.');
        setMode('signin');
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword(parsed.data);
        if (signInError) throw signInError;
        // The root layout picks up the session change and navigates.
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>Vitalis</Text>
          <Text style={styles.title}>
            {mode === 'signin' ? 'Masuk ke akunmu' : 'Buat akun baru'}
          </Text>
          <Text style={styles.subtitle}>
            Catat nutrisi, air, tidur, langkah, dan berat badan dalam satu tempat.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="nama@email.com"
              placeholderTextColor={theme.textDim}
              style={styles.input}
            />

            <Text style={styles.label}>Kata sandi</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Minimal 8 karakter"
              placeholderTextColor={theme.textDim}
              style={styles.input}
            />

            {error != null && <ErrorNote error={error} />}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <Button
              label={mode === 'signin' ? 'Masuk' : 'Daftar'}
              onPress={submit}
              loading={busy}
              style={{ marginTop: spacing.md }}
            />

            <Text
              style={styles.switch}
              onPress={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
            >
              {mode === 'signin'
                ? 'Belum punya akun? Daftar'
                : 'Sudah punya akun? Masuk'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  container: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  brand: { color: theme.brand, fontSize: 26, fontWeight: '700' },
  title: { color: theme.text, fontSize: 20, fontWeight: '600', marginTop: spacing.sm },
  subtitle: { color: theme.textDim, fontSize: 13, marginTop: 4 },
  form: { marginTop: spacing.xl, gap: spacing.sm },
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
  notice: { color: theme.brand, fontSize: 13 },
  switch: {
    color: theme.brand,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontSize: 14,
  },
});
