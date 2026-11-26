// Connexion : e-mail + mot de passe (création de compte ou connexion), Apple sur iPhone.
// « Mot de passe oublié ? » envoie un code par e-mail pour en choisir un nouveau.
import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Burst, ComicButton, Panel, SpeedLinesBackground } from '../src/components/comic';
import { t } from '../src/i18n';
import { Alert } from '../src/lib/alert';
import { supabase } from '../src/lib/supabase';
import { colors, comicShadow, fonts } from '../src/theme';

type Mode = 'signin' | 'signup' | 'reset';

export default function Login() {
  const L = t().login;
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const mail = email.trim().toLowerCase();
  const emailOk = /^\S+@\S+\.\S+$/.test(mail);
  const pwdOk = password.length >= 6;

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

  async function signin() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    setBusy(false);
    if (error) Alert.alert(t().errors.generic, /invalid/i.test(error.message) ? L.badCredentials : error.message);
  }

  async function signup() {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: mail, password });
    setBusy(false);
    if (error) return Alert.alert(t().errors.generic, /already|registered|exists/i.test(error.message) ? L.alreadyUsed : error.message);
    // Compte existant (Supabase ne le dit pas toujours) : aucune identité créée
    if (data.user && (data.user.identities ?? []).length === 0) return Alert.alert(t().errors.generic, L.alreadyUsed);
    if (!data.session) Alert.alert(L.signupTab, L.checkEmail);
  }

  async function sendResetCode() {
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(mail);
    setBusy(false);
    if (error) return Alert.alert(t().errors.generic, error.message);
    setCodeSent(true);
  }

  async function saveNewPassword() {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: mail, token: code.trim(), type: 'recovery' });
    if (error) { setBusy(false); return Alert.alert(t().errors.generic, error.message); }
    const { error: e2 } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e2) return Alert.alert(t().errors.generic, e2.message);
    Alert.alert(L.resetDone);
  }

  const passwordField = (placeholder: string, autoComplete: 'current-password' | 'new-password') => (
    <View>
      <TextInput
        style={[styles.input, { paddingRight: 70 }]} placeholder={placeholder} value={password} onChangeText={setPassword}
        secureTextEntry={!showPwd} autoCapitalize="none" autoCorrect={false} autoComplete={autoComplete}
        textContentType={autoComplete === 'new-password' ? 'newPassword' : 'password'} accessibilityLabel={placeholder}
        onSubmitEditing={() => { if (mode === 'signin' && emailOk && password) signin(); }}
      />
      <Pressable onPress={() => setShowPwd((v) => !v)} style={styles.eye} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.eyeText}>{showPwd ? L.hide : L.show}</Text>
      </Pressable>
    </View>
  );

  return (
    <SpeedLinesBackground cy={30}>
      <SafeAreaView style={styles.wrap}>
        <Burst width={300} height={210} fill={colors.red} rotate={-6} style={{ alignSelf: 'center' }}>
          <Text style={styles.logo}>{'WHO DA\nBOSS ?'}</Text>
        </Burst>

        <Panel style={{ gap: 12 }} tilt={-1}>
          {mode === 'reset' ? (
            <>
              <Text style={styles.title}>{L.resetTitle}</Text>
              <Text style={styles.hint}>{L.resetIntro}</Text>
              <TextInput style={styles.input} placeholder={L.email} keyboardType="email-address" autoCapitalize="none"
                autoComplete="email" value={email} onChangeText={setEmail} accessibilityLabel={L.email} />
              {codeSent && (
                <>
                  <Text style={styles.hint}>{L.codeSent}</Text>
                  <TextInput style={styles.input} placeholder={L.code} keyboardType="number-pad" value={code}
                    onChangeText={setCode} accessibilityLabel={L.code} autoComplete="one-time-code" />
                  {passwordField(`${L.newPassword} (${L.passwordHint})`, 'new-password')}
                </>
              )}
              <ComicButton
                label={codeSent ? L.resetSave : L.sendCode} size={22}
                disabled={busy || !emailOk || (codeSent && (code.trim().length < 6 || !pwdOk))}
                onPress={codeSent ? saveNewPassword : sendResetCode}
              />
              <Pressable onPress={() => { setMode('signin'); setCodeSent(false); setCode(''); }} accessibilityRole="button">
                <Text style={styles.link}>{L.back}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.tabs}>
                {(['signin', 'signup'] as const).map((m) => (
                  <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}
                    style={[styles.tab, comicShadow(mode === m ? 4 : 2), mode === m && styles.tabOn]}>
                    <Text style={[styles.tabText, mode === m && { color: colors.yellow }]}>{m === 'signin' ? L.signinTab : L.signupTab}</Text>
                  </Pressable>
                ))}
              </View>

              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={{ height: 50 }}
                  onPress={apple}
                />
              )}
              <TextInput style={styles.input} placeholder={L.email} keyboardType="email-address" autoCapitalize="none"
                autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail} accessibilityLabel={L.email} />
              {passwordField(mode === 'signup' ? `${L.password} (${L.passwordHint})` : L.password,
                mode === 'signup' ? 'new-password' : 'current-password')}
              <ComicButton
                label={mode === 'signin' ? L.signin : L.signup} size={24}
                disabled={busy || !emailOk || (mode === 'signup' ? !pwdOk : password.length === 0)}
                onPress={mode === 'signin' ? signin : signup}
              />
              <Pressable onPress={() => setMode('reset')} accessibilityRole="button">
                <Text style={styles.link}>{L.forgot}</Text>
              </Pressable>
            </>
          )}
        </Panel>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, justifyContent: 'center', gap: 24 },
  logo: { fontFamily: fonts.comic, fontSize: 52, lineHeight: 48, textAlign: 'center', color: colors.yellow,
    textShadowColor: colors.ink, textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0 },
  title: { fontFamily: fonts.comic, fontSize: 26, letterSpacing: 1 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 12, paddingVertical: 6, alignItems: 'center' },
  tabOn: { backgroundColor: colors.red },
  tabText: { fontFamily: fonts.comic, fontSize: 17, letterSpacing: 1, color: colors.ink },
  input: { borderWidth: 3, borderColor: colors.ink, borderRadius: 12, paddingHorizontal: 14, height: 50,
    fontFamily: fonts.bodyBold, fontSize: 16, backgroundColor: colors.white },
  eye: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.blue },
  hint: { fontFamily: fonts.bodyBold, fontSize: 13 },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.blue, textAlign: 'center', textDecorationLine: 'underline' },
});
