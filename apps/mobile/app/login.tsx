import { authErrorMessage, credentialsSchema } from '@calorya/core';
import { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorNote, PasswordInput } from '../src/components/ui';
import { authCallbackUrl, passwordResetUrl } from '../src/lib/site';
import { supabase } from '../src/lib/supabase';
import { radius, spacing, useTheme, useThemedStyles, type Theme } from '../src/lib/theme';

export default function LoginScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * What sign-up produced, as a shape rather than a sentence.
   *
   * The old version set a one-line notice and flipped the form to sign-in,
   * which on screen reads as a rejection: the fields empty themselves, the
   * button changes, and the only sign of success is a line most people miss.
   */
  const [signedUp, setSignedUp] = useState<{
    email: string;
    linkHost: string | null;
    /** false = the address was already registered, so nothing was created. */
    created: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setNotice(null);
    setSignedUp(null);

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0]?.message ?? 'Data tidak valid'));
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        /**
         * Without an explicit emailRedirectTo, Supabase builds the confirmation
         * link from the project's Site URL — which is http://localhost:3000 in
         * a fresh project, and a dead link on a phone. Pointing it at the
         * deployed web callback is what makes the email usable.
         *
         * Note that Supabase only honours this if the URL is also listed under
         * Authentication → URL Configuration → Redirect URLs. If it is not, it
         * silently falls back to Site URL again, which is what makes this bug
         * so confusing to chase.
         */
        const redirectTo = authCallbackUrl();
        const { data, error: signUpError } = await supabase.auth.signUp({
          ...parsed.data,
          ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
        });
        if (signUpError) throw signUpError;

        /**
         * Whether a confirmation email is required is a project setting, so
         * read the answer off the response rather than guessing. With
         * confirmation off Supabase returns a session, the root layout picks
         * it up and navigates — telling the user to check an inbox would be
         * wrong, and the email is never coming.
         */
        if (!data.session && data.user && (data.user.identities?.length ?? 0) === 0) {
          /*
           * The address is ALREADY REGISTERED.
           *
           * Supabase will not say so — naming which addresses have accounts is
           * an enumeration attack — so it returns success with a fabricated
           * user whose `identities` array is empty. No error, no session,
           * nothing created. Without this branch it is indistinguishable from
           * "check your inbox", which is how re-testing with one address
           * produces a confirmation message forever and no email ever.
           */
          setSignedUp({ email: parsed.data.email, linkHost: null, created: false });
          setMode('signin');
        } else if (!data.session) {
          /*
           * Created, but no session came back — the project asks for email
           * confirmation. Try signing in anyway before giving up.
           *
           * Why bother: the setting lives in the Supabase dashboard, not in
           * this build, so the app cannot know it in advance and must not
           * assume. When confirmation is off but the response happens to omit
           * a session, this quietly puts the person where they belong — the
           * setup screens — instead of parking them on a "check your inbox"
           * card for an email that is never sent.
           *
           * When confirmation really is on, this fails with "Email not
           * confirmed" and costs one request; the card below is then the
           * correct answer and is shown exactly as before. Its failure is
           * deliberately ignored: sign-up itself succeeded, and reporting a
           * failed convenience attempt as an error would be a lie.
           */
          const { data: signedIn } = await supabase.auth.signInWithPassword(parsed.data);
          if (signedIn.session) {
            // The root gate sees the new session and moves to /onboarding.
            // Navigating from here would race it.
            return;
          }

          /*
           * Name the destination. When EXPO_PUBLIC_SITE_URL is unset — a
           * local `expo start` without a .env — no emailRedirectTo is sent at
           * all and Supabase quietly uses the project's Site URL, which is
           * localhost in a fresh project. Nothing errors; the only symptom is
           * a dead link in an inbox. Saying where the link goes makes that
           * visible at the moment of sign-up instead of hours later.
           */
          setSignedUp({
            email: parsed.data.email,
            linkHost: redirectTo
              ? redirectTo.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
              : null,
            created: true,
          });
          setMode('signin');
          setPassword('');
        }
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword(parsed.data);
        if (signInError) throw signInError;
        // The root layout picks up the session change and navigates.
      }
    } catch (err) {
      setError(new Error(authErrorMessage(err)));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Send a reset link.
   *
   * The confirmation is the same whether or not the address has an account:
   * telling a stranger "email tidak terdaftar" turns this button into a way to
   * check who uses a health app.
   */
  async function sendReset() {
    setError(null);
    setNotice(null);

    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setError(new Error('Isi alamat email dulu, lalu tekan Lupa kata sandi.'));
      return;
    }

    const redirectTo = passwordResetUrl();
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        redirectTo ? { redirectTo } : undefined,
      );
      if (resetError) throw resetError;
      setNotice(
        'Kalau email itu terdaftar, tautan ganti kata sandi sudah dikirim. Tautannya berlaku satu jam dan dibuka lewat peramban.',
      );
    } catch (err) {
      setError(new Error(authErrorMessage(err)));
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
          <Text style={styles.brand}>Calorya</Text>
          <Text style={styles.title}>
            {mode === 'signin' ? 'Masuk ke akunmu' : 'Buat akun baru'}
          </Text>
          <Text style={styles.subtitle}>
            Catat nutrisi, air, tidur, langkah, dan berat badan dalam satu tempat.
          </Text>

          {signedUp ? (
            <View
              style={[styles.successCard, !signedUp.created && styles.noticeCard]}
              accessibilityRole="summary"
            >
              <Text
                style={[styles.successTitle, !signedUp.created && styles.noticeTitle]}
              >
                {signedUp.created ? '✓ Akun berhasil dibuat' : 'ℹ Email ini sudah terdaftar'}
              </Text>
              {signedUp.created ? (
                <>
                  <Text style={styles.successBody}>
                    Untuk <Text style={styles.successStrong}>{signedUp.email}</Text>.
                  </Text>
                  <Text style={styles.successBody}>
                    Satu langkah lagi: buka tautan konfirmasi di email itu, lalu masuk
                    di bawah. Setelah masuk pertama kali kamu akan dipandu mengisi data
                    diri dan target.
                  </Text>
                  <Text style={styles.successMeta}>
                    {signedUp.linkHost
                      ? `Tautannya menuju ${signedUp.linkHost}. Belum masuk dalam beberapa menit? Periksa folder spam.`
                      : 'EXPO_PUBLIC_SITE_URL belum di-set, jadi tautannya memakai Site URL bawaan proyek Supabase.'}
                  </Text>
                </>
              ) : (
                <Text style={styles.successBody}>
                  <Text style={styles.successStrong}>{signedUp.email}</Text> sudah punya
                  akun. Masuk saja di bawah — atau pakai “Lupa kata sandi?” kalau
                  sandinya lupa.
                </Text>
              )}
            </View>
          ) : null}

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
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />

            {mode === 'signin' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void sendReset()}
                disabled={busy}
                style={{ alignSelf: 'flex-end' }}
              >
                <Text style={styles.forgot}>Lupa kata sandi?</Text>
              </Pressable>
            ) : null}

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

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
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
    successCard: {
      backgroundColor: theme.brandSoft,
      borderColor: theme.brand,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: 6,
      marginBottom: spacing.lg,
    },
    successTitle: { color: theme.brand, fontSize: 15, fontWeight: '700' },
    noticeCard: { backgroundColor: theme.surface, borderColor: theme.border },
    noticeTitle: { color: theme.text },
    successBody: { color: theme.textMuted, fontSize: 13, lineHeight: 20 },
    successStrong: { color: theme.text, fontWeight: '600' },
    successMeta: { color: theme.textDim, fontSize: 12, lineHeight: 18, marginTop: 2 },
    forgot: {
      color: theme.textMuted,
      fontSize: 13,
      textDecorationLine: 'underline',
      paddingVertical: 4,
    },
    switch: {
      color: theme.brand,
      textAlign: 'center',
      marginTop: spacing.lg,
      fontSize: 14,
    },
  });
