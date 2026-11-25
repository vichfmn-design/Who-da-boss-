// La révélation : BOOM ! si tu gagnes, PAF ! sinon, puis le détail question par question.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bomb, Burst, ComicButton, Panel, SpeechBubble, SpeedLinesBackground, Star } from '../../src/components/comic';
import { t } from '../../src/i18n';
import { api, type Reveal } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';
import { BURST_B, colors, comicShadow, fonts } from '../../src/theme';

export default function RevealScreen() {
  const R = t().reveal;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const [data, setData] = useState<Reveal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.reveal(id).then(setData).catch((e: Error) => setError(e.message)); }, [id]);

  if (error) {
    return (
      <SpeedLinesBackground>
        <SafeAreaView style={styles.wrap}>
          <Panel><Text style={styles.text}>{error}</Text></Panel>
          <ComicButton label="OK" onPress={() => router.back()} />
        </SafeAreaView>
      </SpeedLinesBackground>
    );
  }
  if (!data) return <SpeedLinesBackground><ActivityIndicator style={{ flex: 1 }} color={colors.ink} /></SpeedLinesBackground>;

  const me = data.players.find((p) => p.user_id === session?.user.id);
  const iWon = data.winner === session?.user.id;
  const minesOnMe = me?.answers?.filter((a) => !a.correct && (data.questions[a.index]?.mines ?? 0) > (me.mine === a.index ? 1 : 0)).length ?? 0;

  return (
    <SpeedLinesBackground cy={25}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap}>
          <Burst width={340} height={300} fill={iWon ? colors.red : colors.skyDeep} rotate={-6} shadow={9} style={{ alignSelf: 'center' }}>
            <Text style={styles.boom}>{iWon ? R.boom : R.paf}</Text>
            <Text style={styles.sub}>{iWon ? R.won : R.lost}</Text>
          </Burst>

          {/* Score de chaque joueur */}
          <View style={[styles.scores, comicShadow(5)]}>
            {data.players.map((p, i) => (
              <View key={p.user_id} style={[styles.scoreRow, i > 0 && styles.scoreBorder,
                { backgroundColor: p.user_id === session?.user.id ? colors.red : colors.white }]}>
                <Text style={[styles.rank, p.user_id === session?.user.id && { color: colors.yellow }]}>{p.rank}</Text>
                <Text style={[styles.name, p.user_id === session?.user.id && { color: colors.yellow }]}>{p.pseudo.toUpperCase()}</Text>
                <Text style={[styles.pts, p.user_id === session?.user.id && { color: colors.yellow }]}>
                  {p.forfeit ? R.forfeit : R.points(p.points)}
                </Text>
                {data.winner === p.user_id && <Star size={22} />}
              </View>
            ))}
          </View>

          {minesOnMe > 0 && (
            <SpeechBubble color={colors.yellow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Bomb size={28} spark={colors.red} />
                <Text style={styles.text}>{`${minesOnMe} × ${R.mineHit}`}</Text>
              </View>
            </SpeechBubble>
          )}

          {/* Détail des questions */}
          {data.questions.map((q) => {
            const mine = me?.answers?.find((a) => a.index === q.index);
            return (
              <Panel key={q.index} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.qNum}>Q{q.index + 1}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {q.mines > 0 && <><Bomb size={20} /><Text style={styles.small}>×{q.mines}</Text></>}
                    {mine && (
                      <Burst width={62} height={44} fill={mine.correct ? colors.green : colors.red} shape={BURST_B} shadow={2} outline={2}>
                        <Text style={[styles.small, { color: colors.white }]}>{R.points(mine.points)}</Text>
                      </Burst>
                    )}
                  </View>
                </View>
                <Text style={styles.text}>{q.prompt}</Text>
                <Text style={[styles.small, { color: colors.green }]}>✓ {q.choices[q.correct_index]}</Text>
                {mine && !mine.correct && mine.choice !== null && (
                  <Text style={[styles.small, { color: colors.red }]}>✗ {q.choices[mine.choice]}{mine.sure ? ` · ${t().duel.sure}` : ''}</Text>
                )}
              </Panel>
            );
          })}

          <ComicButton label={R.seeBoard} color={colors.ink} onPress={() => router.replace('/tableau')} size={26} />
        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 16, paddingBottom: 40 },
  boom: { fontFamily: fonts.comic, fontSize: 84, letterSpacing: 3, color: colors.yellow,
    textShadowColor: colors.ink, textShadowOffset: { width: 6, height: 6 }, textShadowRadius: 0 },
  sub: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1, color: colors.white,
    textShadowColor: colors.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  scores: { borderWidth: 3, borderColor: colors.ink, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.white },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 6 },
  scoreBorder: { borderTopWidth: 2, borderColor: colors.ink },
  rank: { fontFamily: fonts.comic, fontSize: 22, width: 18 },
  name: { flex: 1, fontFamily: fonts.comic, fontSize: 24, letterSpacing: 1 },
  pts: { fontFamily: fonts.comic, fontSize: 24 },
  qNum: { fontFamily: fonts.comic, fontSize: 22, color: colors.red },
  text: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  small: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink },
});
