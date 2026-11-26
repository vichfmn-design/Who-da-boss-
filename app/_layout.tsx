import { Bangers_400Regular } from '@expo-google-fonts/bangers';
import { DMSans_500Medium, DMSans_700Bold, DMSans_800ExtraBold } from '@expo-google-fonts/dm-sans';
import { LuckiestGuy_400Regular } from '@expo-google-fonts/luckiest-guy';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { DialogHost } from '../src/lib/alert';
import { setPendingInvite, usePrefs } from '../src/lib/prefs';
import { SessionProvider, useSession } from '../src/lib/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { ready, session, profile } = useSession();
  const { loaded, rulesSeen, pendingInvite } = usePrefs();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !loaded) return;
    const first = segments[0] as string | undefined;

    // Lien d'invitation ouvert avant d'avoir un compte prêt : on le garde pour après.
    if (first === 'invite' && (!session || !profile || !rulesSeen)) {
      const code = pathname.split('/').filter(Boolean).pop();
      if (code && code !== pendingInvite) setPendingInvite(code);
    }

    if (!session) { if (first !== 'login') router.replace('/login'); return; }
    if (!profile) { if (first !== 'onboarding') router.replace('/onboarding'); return; }
    if (!rulesSeen) { if (first !== 'regles') router.replace('/regles'); return; }
    if (pendingInvite && first !== 'invite') { router.replace(`/invite/${pendingInvite}`); return; }
    if (first === 'login' || first === 'onboarding') router.replace('/');
  }, [ready, loaded, session, profile, rulesSeen, pendingInvite, segments, pathname, router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="regles" />
      <Stack.Screen name="duel/[id]" options={{ gestureEnabled: false }} />
      <Stack.Screen name="reveal/[id]" />
      <Stack.Screen name="invite/[code]" />
      <Stack.Screen name="boost/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Bangers_400Regular, LuckiestGuy_400Regular, DMSans_500Medium, DMSans_700Bold, DMSans_800ExtraBold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      {/* Sur ordinateur, l'app garde une largeur de téléphone, centrée */}
      <View style={styles.app}>
        <Gate />
      </View>
      <DialogHost />
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  app: Platform.OS === 'web'
    ? { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', overflow: 'hidden' }
    : { flex: 1 },
});
