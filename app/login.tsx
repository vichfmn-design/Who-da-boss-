// Connexion : Apple (iPhone) ou code reçu par e-mail.
import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Burst, ComicButton, Panel, SpeedLinesBackground } from '../src/components/comic';
import { t } from '../src/i18n';
import { supabase } from '../src/lib/supabase';
import { colors, fonts } from '../src/theme';
import { Alert } from '../src/lib/alert';

export default function Login() {
  const L = t().login;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function apple() {
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!cred.identityToken) throw new Error('Pas de jeton Apple');
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
      if (error) throw error;
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code !== 'ERR_REQUEST_CANCELED') Alert.alert(t().errors.generic, err.message);
    }
  }

  async function sendCode() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (error) return Alert.alert(t().errors.generic, error.message);
    setSent(true);
  }

  async function verify() {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) Alert.alert(t().errors.generic, error.message);
  }

  return (
    <SpeedLinesBackground cy={30}>
      <SafeAreaView style={styles.wrap}>
        <Burst width={320} height={240} fill={colors.red} rotate={-6} style={{ alignSelf: 'center' }}>
          <Text style={styles.logo}>{'WHO DA\nBOSS ?'}</Text>
        </Burst>

        <Panel style={{ gap: 12 }} tilt={-1}>
          <Text style={styles.title}>{L.title}</Text>
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={{ height: 50 }}
              onPress={apple}
            />
          )}
          <TextInput
            style={styles.input} placeholder={L.email} keyboardType="email-address" autoCapitalize="none"
            autoComplete="email" value={email} onChangeText={setEmail} accessibilityLabel={L.email}
          />
          {sent && (
            <>
              <Text style={styles.hint}>{L.codeSent}</Text>
              <TextInput
                style={styles.input} placeholder={L.code} keyboardType="number-pad" value={code}
                onChangeText={setCode} accessibilityLabel={L.code} autoComplete="one-time-code"
              />
            </>
          )}
          <ComicButton
            label={sent ? L.verify : L.sendCode} size={24} disabled={busy || !email.includes('@')}
            onPress={sent ? verify : sendCode}
          />
        </Panel>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, justifyContent: 'center', gap: 28 },
  logo: { fontFamily: fonts.comic, fontSize: 58, lineHeight: 54, textAlign: 'center', color: colors.yellow,
    textShadowColor: colors.ink, textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0 },
  title: { fontFamily: fonts.comic, fontSize: 26, letterSpacing: 1 },
  input: { borderWidth: 3, borderColor: colors.ink, borderRadius: 12, paddingHorizontal: 14, height: 50,
    fontFamily: fonts.bodyBold, fontSize: 16, backgroundColor: colors.white },
  hint: { fontFamily: fonts.bodyBold, fontSize: 13 },
});
