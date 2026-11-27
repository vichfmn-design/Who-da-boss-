// Parties du jour : une explosion par duel (bleue) ou par groupe (verte), le nom dans la bulle.
// On touche une explosion pour lancer sa partie.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Burst, ComicButton, SpeechBubble, SpeedLinesBackground, Star, WackyTitle } from '../src/components/comic';
import { t } from '../src/i18n';
import { api, type MyMatch } from '../src/lib/api';
import { Alert } from '../src/lib/alert';
import { colors, comicShadow, fonts } from '../src/theme';

const DUEL = { fill: '#4DA6E8', glow: '#BFE3FA', shadow: '#123E73' };
const GROUP = { fill: '#3DB167', glow: '#BDF0CC', shadow: '#0E4D29' };

export default function Jouer() {
  const J = t().jouer;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [matches, setMatches] = useState<MyMatch[] | null>(null);
  const [played, setPlayed] = useState<MyMatch[]>([]);
  const [openName, setOpenName] = useState<string | null>(null);
  // Parties jouées regroupées par rival (duel) ou par groupe
  const groups = Object.values(played.reduce<Record<string, { key: string; name: string; isGroup: boolean; games: MyMatch[] }>>((acc, m) => {
    const key = m.group_id ?? m.connection_id ?? m.match_id;
    const name = (m.group_id ? (m.group_name ?? m.opponents) : m.opponents) ?? '';
    (acc[key] ??= { key, name, isGroup: !!m.group_id, games: [] }).games.push(m);
    return acc;
  }, {})).map((g) => ({ ...g, games: g.games.sort((a, b) => b.opens_at.localeCompare(a.opens_at)) }))
    .sort((a, b) => Number(b.games.some((m) => m.minigame_todo)) - Number(a.games.some((m) => m.minigame_todo)) || a.name.localeCompare(b.name));
  const w = Math.min(Math.min(width, 560) - 70, 330);
  const h = Math.round(w * 0.78);

  useFocusEffect(useCallback(() => {
    api.myMatches().then((m) => {
      setMatches(m.filter((x) => x.status === 'open' && !x.i_finished));
      // Les parties dont le mini-jeu reste à jouer en premier
      setPlayed(m.filter((x) => x.i_finished || x.status === 'closed')
        .sort((a, b) => Number(!!b.minigame_todo) - Number(!!a.minigame_todo)));
    }).catch(() => setMatches([]));
  }, []));

  return (
    <SpeedLinesBackground cy={10}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap}>
          <View style={styles.top}>
            <Pressable onPress={() => router.back()} style={[styles.pill, comicShadow(3)]} accessibilityRole="button">
              <Text style={styles.pillText}>{J.back}</Text>
            </Pressable>
          </View>
          <WackyTitle text={J.title} size={38} />

          {!matches && <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />}
          {matches?.length === 0 && (
            <>
              <SpeechBubble style={{ alignSelf: 'center', transform: [{ rotate: '-3deg' }] }}>
                <Text style={styles.bubble}>{J.none}</Text>
              </SpeechBubble>
              <ComicButton label={J.toRivals} size={26} onPress={() => router.replace('/rivaux')} />
            </>
          )}

          {matches?.map((m, i) => {
            const isGroup = !!m.group_id;
            const c = isGroup ? GROUP : DUEL;
            const left = i % 2 === 0;
            const name = isGroup ? (m.group_name ?? m.opponents ?? '') : (m.opponents ?? '');
            const others = m.players_finished > 0;
            return (
              <Pressable key={m.match_id} onPress={() => router.push(`/duel/${m.match_id}`)} accessibilityRole="button"
                accessibilityLabel={`${isGroup ? J.group : J.duel} ${name}`}
                style={({ pressed }) => ({ alignSelf: left ? 'flex-start' : 'flex-end', paddingTop: 26,
                  transform: [{ scale: pressed ? 0.96 : 1 }] })}>
                <Burst width={w} height={h} fill={c.fill} glow={c.glow} rotate={left ? -5 : 5} shadow={8}>
                  <Text style={[styles.burstTitle, { fontSize: w * 0.13, lineHeight: w * 0.135, textShadowColor: c.shadow }]}>
                    {m.card_multiplier === 2 ? J.card : isGroup ? J.group : J.duel}
                  </Text>
                  <Text style={[styles.burstSub, { fontSize: Math.max(12, w * 0.042) }]}>
                    {m.theme_name.toUpperCase()} · {J.length}
                  </Text>
                </Burst>
                <SpeechBubble tail="bottom" style={[styles.nameBubble, left ? { right: -6 } : { left: -6 },
                  { transform: [{ rotate: left ? '4deg' : '-4deg' }] }]}>
                  <Text style={styles.bubble} numberOfLines={1}>{name.toUpperCase()}</Text>
                  {others && <Text style={styles.waiting}>{J.theyPlayed}</Text>}
                </SpeechBubble>
                <View pointerEvents="none" style={[styles.star, left ? { left: w - 30 } : { left: 4 }]}>
                  <Star size={i % 3 === 0 ? 34 : 24} />
                </View>
              </Pressable>
            );
          })}

          {played.length > 0 && (
            <>
              <Text style={styles.playedTitle}>{J.played}</Text>
              {/* Un menu déroulant par rival / groupe ; dedans, ses parties (les plus récentes d'abord) */}
              {groups.map((g) => {
                const isOpen = openName === g.key;
                const todo = g.games.some((m) => m.minigame_todo);
                return (
                  <View key={g.key} style={{ gap: 6 }}>
                    <Pressable onPress={() => setOpenName(isOpen ? null : g.key)} accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      style={[styles.playedRow, comicShadow(3), { backgroundColor: g.isGroup ? GROUP.fill : DUEL.fill }]}>
                      <Text style={styles.chev}>{isOpen ? '▼' : '▶'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playedName} numberOfLines={1}>{g.name.toUpperCase()}</Text>
                        <Text style={styles.playedSub}>{J.gamesCount(g.games.length)}</Text>
                      </View>
                      {todo && <View style={[styles.miniTag, comicShadow(2)]}><Text style={styles.miniTagText}>🎮</Text></View>}
                    </Pressable>
                    {isOpen && g.games.map((m) => (
                      <Pressable key={m.match_id} onPress={() => router.push(`/reveal/${m.match_id}`)} accessibilityRole="button"
                        style={[styles.gameRow, comicShadow(2)]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.gameTheme} numberOfLines={1}>{m.theme_name}</Text>
                          <Text style={styles.gameDate}>{new Date(m.opens_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
                        </View>
                        {m.minigame_todo && (
                          <Pressable accessibilityRole="button" accessibilityLabel={J.miniTodo} onPress={() => {
                            api.matchMinigame(m.match_id).then((cid) => router.push(`/minijeu/${cid}`))
                              .catch((e: Error) => Alert.alert(t().errors.generic, e.message));
                          }} style={[styles.miniTag, comicShadow(2)]}>
                            <Text style={styles.miniTagText}>{J.miniTodo}</Text>
                          </Pressable>
                        )}
                        <Text style={styles.playedState}>{m.status === 'closed' ? J.results : J.waiting}</Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 6, paddingBottom: 60 },
  top: { flexDirection: 'row' },
  pill: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3 },
  pillText: { fontFamily: fonts.comic, fontSize: 18, letterSpacing: 1 },
  burstTitle: { fontFamily: fonts.comic, color: colors.yellow, textAlign: 'center', letterSpacing: 1,
    textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  burstSub: { fontFamily: fonts.comic, color: colors.white, letterSpacing: 1, textAlign: 'center', marginTop: 4,
    textShadowColor: colors.ink, textShadowOffset: { width: 1.5, height: 1.5 }, textShadowRadius: 0, maxWidth: '62%' },
  nameBubble: { position: 'absolute', top: 0, maxWidth: '72%' },
  bubble: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1, color: colors.ink, textAlign: 'center' },
  waiting: { fontFamily: fonts.bodyHeavy, fontSize: 11, color: colors.red, textAlign: 'center' },
  star: { position: 'absolute', bottom: 6 },
  chev: { fontFamily: fonts.comic, fontSize: 18, color: colors.white },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 18, backgroundColor: colors.white, borderWidth: 2,
    borderColor: colors.ink, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  gameTheme: { fontFamily: fonts.comic, fontSize: 17, letterSpacing: 0.5, color: colors.ink },
  gameDate: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.grey },
  miniTag: { backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  miniTagText: { fontFamily: fonts.comic, fontSize: 15, letterSpacing: 0.5, color: colors.yellow },
  playedTitle: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1, marginTop: 18 },
  playedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 3, borderColor: colors.ink, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8 },
  playedName: { fontFamily: fonts.comic, fontSize: 20, letterSpacing: 1, color: colors.white,
    textShadowColor: colors.ink, textShadowOffset: { width: 1.5, height: 1.5 }, textShadowRadius: 0 },
  playedSub: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
  playedState: { fontFamily: fonts.comic, fontSize: 15, letterSpacing: 0.5, color: colors.ink, backgroundColor: colors.yellow,
    borderWidth: 2, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
});
