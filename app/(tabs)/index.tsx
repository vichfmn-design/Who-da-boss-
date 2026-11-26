// Accueil : la grosse explosion « WHO DA BOSS ? » lance le prochain duel à jouer.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Burst, SpeechBubble, SpeedLinesBackground, Star } from '../../src/components/comic';
import { t } from '../../src/i18n';
import { api, type MyMatch } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';
import { colors, comicShadow, fonts } from '../../src/theme';

export default function Home() {
  const router = useRouter();
  const { profile } = useSession();
  const [matches, setMatches] = useState<MyMatch[]>([]);
  const [loading, setLoading] = useState(false);
  // L'explosion « WHO DA BOSS ? » remplit l'écran (largeur de téléphone, limitée sur ordinateur)
  const { width, height } = useWindowDimensions();
  const size = Math.min(Math.min(width, 560) - 50, height * 0.6);
  const box = Math.min(size + 60, Math.min(width, 560));
  const ring = box / 2 - 18;
  // 5 étoiles autour de l'explosion : 1 petite, 3 moyennes, 1 grande, placées au hasard
  const stars = useMemo(() => {
    const sizes = [16, 26, 26, 26, 40].sort(() => Math.random() - 0.5);
    const start = Math.random() * 360;
    return sizes.map((sz, k) => {
      const a = ((start + k * 72 + (Math.random() * 30 - 15)) * Math.PI) / 180;
      const k2 = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      return { size: sz, x: Math.cos(a) / k2, y: Math.sin(a) / k2, rot: Math.random() * 40 - 20 };
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMatches(await api.myMatches()); } catch { /* hors ligne : on garde l'affichage */ }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toPlay = matches.filter((m) => m.status === 'open' && !m.i_finished);
  const next = toPlay[0];
  const othersPlayed = next && next.players_finished > 0;

  return (
    <SpeedLinesBackground cy={42}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.wrap}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        >
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
              <Pressable onPress={() => router.push('/regles?from=profil')} accessibilityRole="button"
                accessibilityLabel={t().profile.rules} style={[styles.help, comicShadow(3)]}>
                <Text style={styles.helpText}>?</Text>
              </Pressable>
              <Text style={styles.pseudo}>{profile?.pseudo}</Text>
            </View>
          </View>

          <SpeechBubble style={{ alignSelf: 'center', transform: [{ rotate: '-3deg' }] }}>
            <Text style={styles.bubbleText}>{t().duelsWaiting(toPlay.length)}</Text>
          </SpeechBubble>

          <View style={{ alignSelf: 'center', width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
          {stars.map((st, k) => (
            <View key={k} pointerEvents="none" style={{ position: 'absolute',
              left: box / 2 + st.x * ring - st.size / 2,
              top: box / 2 + st.y * ring - st.size / 2,
              transform: [{ rotate: `${st.rot}deg` }] }}>
              <Star size={st.size} />
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t().tapToPlay}
            onPress={() => (next ? router.push(`/duel/${next.match_id}`) : router.push('/rivaux'))}
            style={({ pressed }) => ({ alignSelf: 'center', transform: [{ scale: pressed ? 0.96 : 1 }] })}
          >
            <Burst width={size} height={size} fill={colors.red} rotate={-6} shadow={9}>
              <Text style={[styles.logo, { fontSize: size * 0.155, lineHeight: size * 0.15 }]}>{'WHO DA\nBOSS ?'}</Text>
              <Text style={[styles.tap, { fontSize: Math.max(17, size * 0.05) }]}>{t().tapToPlay}</Text>
            </Burst>
          </Pressable>
          </View>

          {next && (
            <SpeechBubble color={colors.blue} tail="top" style={{ alignSelf: 'flex-start', marginLeft: 20 }}>
              <Text style={[styles.bubbleText, { color: colors.white, fontFamily: fonts.bodyHeavy, fontSize: 15 }]}>
                {othersPlayed ? t().yourTurn(next.opponents ?? '') : `${next.opponents ?? ''} · ${next.theme_name}`}
              </Text>
            </SpeechBubble>
          )}


          {toPlay.slice(1).map((m) => (
            <Pressable key={m.match_id} onPress={() => router.push(`/duel/${m.match_id}`)} style={[styles.row, comicShadow(4)]}>
              <Text style={styles.rowTitle}>{m.opponents}</Text>
              <Text style={styles.rowSub}>{m.theme_name}{m.card_multiplier === 2 ? ' · ×2' : ''}</Text>
            </Pressable>
          ))}

        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingBottom: 110, gap: 16 },
  header: { position: 'absolute', top: 12, right: 20, flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  pseudo: { fontFamily: fonts.comic, fontSize: 20, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 2, overflow: 'hidden' },
  bubbleText: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1 },
  help: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.red,
    alignItems: 'center', justifyContent: 'center' },
  helpText: { fontFamily: fonts.comic, fontSize: 22, color: colors.yellow },
  logo: { fontFamily: fonts.comic, fontSize: 66, lineHeight: 60, textAlign: 'center', color: colors.yellow,
    textShadowColor: colors.ink, textShadowOffset: { width: 5, height: 5 }, textShadowRadius: 0 },
  tap: { marginTop: 10, fontFamily: fonts.comic, fontSize: 19, letterSpacing: 2, color: colors.white,
    textShadowColor: colors.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  row: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, padding: 12 },
  rowTitle: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1 },
  rowSub: { fontFamily: fonts.bodyBold, fontSize: 13 },
});
