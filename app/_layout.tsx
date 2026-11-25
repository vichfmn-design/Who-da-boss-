import { Bangers_400Regular } from '@expo-google-fonts/bangers';
import { DMSans_500Medium, DMSans_700Bold, DMSans_800ExtraBold } from '@expo-google-fonts/dm-sans';
import { LuckiestGuy_400Regular } from '@expo-google-fonts/luckiest-guy';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SessionProvider, useSession } from '../src/lib/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { ready, session, profile } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const first = segments[0] as string | undefined;
    const inAuth = first === 'login';
    const inOnboarding = first === 'onboarding';
    if (!session && !inAuth) router.replace('/login');
    else if (session && !profile && !inOnboarding) router.replace('/onboarding');
    else if (session && profile && (inAuth || inOnboarding)) router.replace('/');
  }, [ready, session, profile, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="duel/[id]" options={{ gestureEnabled: false }} />
      <Stack.Screen name="reveal/[id]" />
      <Stack.Screen name="invite/[code]" />
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
      <Gate />
    </SessionProvider>
  );
}
