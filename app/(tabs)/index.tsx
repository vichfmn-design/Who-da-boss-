// Accueil : la grosse explosion « WHO DA BOSS ? » lance le prochain duel à jouer.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Burst, SpeechBubble, SpeedLinesBackground, Star } from '../../src/components/comic';
import { t } from '../../src/i18n';
import { api, type BoostChallenge, type MyMatch } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';
import { colors, comicShadow, fonts } from '../../src/theme';

export default function Home() {
  const router = useRouter();
  const { profile } = useSession();
  const [matches, setMatches] = useState<MyMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [boosts, setBoosts] = useState<BoostChallenge[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMatches(await api.myMatches()); } catch { /* hors ligne : on garde l'affichage */ }
    api.myBoosts().then((b) => setBoosts(b.challenges)).catch(() => {});
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toPlay = matches.filter((m) => m.status === 'open' && !m.i_finished);
  const done = matches.filter((m) => m.status === 'closed');
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t().tapToPlay}
            onPress={() => (next ? router.push(`/duel/${next.match_id}`) : router.push('/rivaux'))}
            style={({ pressed }) => ({ alignSelf: 'center', transform: [{ scale: pressed ? 0.96 : 1 }] })}
          >
            <Burst width={330} height={330} fill={colors.red} rotate={-6} shadow={9}>
              <Text style={styles.logo}>{'WHO DA\nBOSS ?'}</Text>
              <Text style={styles.tap}>{t().tapToPlay}</Text>
            </Burst>
          </Pressable>
          <View style={styles.stars} pointerEvents="none">
            <Star size={30} /><Star size={22} /><Star size={26} />
          </View>

          {next && (
            <SpeechBubble color={colors.blue} tail="top" style={{ alignSelf: 'flex-start', marginLeft: 20 }}>
              <Text style={[styles.bubbleText, { color: colors.white, fontFamily: fonts.bodyHeavy, fontSize: 15 }]}>
                {othersPlayed ? t().yourTurn(next.opponents ?? '') : `${next.opponents ?? ''} · ${next.theme_name}`}
              </Text>
            </SpeechBubble>
          )}

          {boosts.filter((b) => (b.status === 'open' && !b.i_finished) || (b.status === 'closed')).slice(0, 3).map((b) => (
            <Pressable key={b.id} onPress={() => router.push(`/boost/${b.id}`)}
              style={[styles.row, comicShadow(4), b.status === 'open' && { backgroundColor: colors.blue }]}>
              <Text style={[styles.rowTitle, b.status === 'open' && { color: colors.yellow }]}>
                {t().boost.homeTitle(t().boost.games[b.game], b.label ?? '')}
              </Text>
              <Text style={[styles.rowSub, b.status === 'open' && { color: colors.white }]}>
                {b.status === 'open' ? t().boost.homePlay : `${t().boost.homeDone}${b.winner ? ` · ★ ${b.winner}${b.winner_points ? ` +${b.winner_points}` : ''}` : ''}`}
              </Text>
            </Pressable>
          ))}

          {toPlay.slice(1).map((m) => (
            <Pressable key={m.match_id} onPress={() => router.push(`/duel/${m.match_id}`)} style={[styles.row, comicShadow(4)]}>
              <Text style={styles.rowTitle}>{m.opponents}</Text>
              <Text style={styles.rowSub}>{m.theme_name}{m.card_multiplier === 2 ? ' · ×2' : ''}</Text>
            </Pressable>
          ))}

          {done.slice(0, 5).map((m) => (
            <Pressable key={m.match_id} onPress={() => router.push(`/reveal/${m.match_id}`)} style={[styles.row, comicShadow(4)]}>
              <Text style={styles.rowTitle}>{m.opponents}</Text>
              <Text style={styles.rowSub}>
                {m.theme_name} · {m.my_rank === 1 ? '★ ' : ''}{t().reveal.points(m.my_points ?? 0)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 110, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  stars: { flexDirection: 'row', justifyContent: 'space-around', marginTop: -30 },
  row: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, padding: 12 },
  rowTitle: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1 },
  rowSub: { fontFamily: fonts.bodyBold, fontSize: 13 },
});
