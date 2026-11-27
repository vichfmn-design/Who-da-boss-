// La révélation : BOOM ! si tu gagnes, PAF ! sinon, puis le détail question par question.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bomb, Burst, ComicButton, Panel, SpeechBubble, SpeedLinesBackground, Star } from '../../src/components/comic';
import { t } from '../../src/i18n';
import { api, type MyAnswers, type Reveal } from '../../src/lib/api';
import { Alert } from '../../src/lib/alert';
import { MineBoom } from '../../src/components/MineBoom';
import { addBoomSeen, getBoomSeen } from '../../src/lib/boomSeen';
import { useSession } from '../../src/lib/session';
import { BURST_B, colors, comicShadow, fonts } from '../../src/theme';

export default function RevealScreen() {
  const R = t().reveal;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
  const [data, setData] = useState<Reveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<MyAnswers | null>(null);

  // Les mines sur lesquelles tu as sauté : BOOM ! + selfies, une seule fois par partie
  const [boomStep, setBoomStep] = useState<number | null>(null);
  const [newBooms, setNewBooms] = useState<NonNullable<Reveal['my_booms']>>([]);
  useEffect(() => {
    api.reveal(id).then(async (r) => {
      setData(r);
      // Seulement les explosions pas encore montrées (celles de fin de partie le sont déjà)
      const seen = await getBoomSeen(id);
      const fresh = (r.my_booms ?? []).filter((b) => !seen.includes(b.index));
      if (fresh.length > 0) {
        setNewBooms(fresh);
        setBoomStep(0);
        addBoomSeen(id, fresh.map((b) => b.index));
      }
    }).catch((e: Error) => {
      // Partie pas encore révélée : tes réponses en attendant les autres
      api.myAnswers(id).then(setPending).catch(() => setError(e.message));
    });
  }, [id]);

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
  const miniGame = () => api.matchMinigame(id).then((cid) => router.push(`/minijeu/${cid}`))
    .catch((e: Error) => Alert.alert(t().errors.generic, e.message));

  if (pending) {
    return (
      <SpeedLinesBackground cy={20}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.wrap}>
            {/* Le gros bouton « MINI-JEUX » (bleu foncé, même explosion) : le mini-jeu bonus de la partie */}
            <Pressable onPress={miniGame} accessibilityRole="button" accessibilityLabel={t().mini.big}
              style={({ pressed }) => ({ alignSelf: 'center', transform: [{ scale: pressed ? 0.96 : 1 }] })}>
              <Burst width={320} height={220} fill={colors.blue} shape={BURST_B} rotate={-4}>
                <Text style={[styles.sub, { fontSize: 44, textAlign: 'center', color: colors.yellow }]}>{t().mini.big}</Text>
                <Text style={[styles.sub, { fontSize: 15, textAlign: 'center' }]}>{t().mini.bigSub}</Text>
              </Burst>
            </Pressable>
            <Panel tilt={-1} style={{ gap: 6 }}>
              <Text style={styles.text}>{R.waitCount(pending.players_finished, pending.players_total)}</Text>
              <Text style={styles.small}>{R.waitInfo}</Text>
            </Panel>
            <Text style={styles.qNum}>{R.myAnswers}</Text>
            {pending.answers.map((a) => (
              <Panel key={a.index} tilt={a.index % 2 ? 1 : -1} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.qNum}>Q{a.index + 1}{a.mine ? ` · 💣 ${R.mineHere}` : ''}</Text>
                  <Burst width={74} height={44} fill={a.correct ? colors.green : colors.red} shape={BURST_B} shadow={2} outline={2}>
                    <Text style={[styles.small, { color: colors.white }]}>{a.correct ? R.right : R.wrong}</Text>
                  </Burst>
                </View>
                <Text style={styles.text}>{a.prompt}</Text>
                <Text style={[styles.small, { color: a.correct ? colors.green : colors.red }]}>
                  {a.correct ? '✓' : '✗'} {a.choice ?? R.noAnswer}{a.sure ? ` · ${t().duel.sure}` : ''}
                </Text>
              </Panel>
            ))}
            <ComicButton label={R.home} color={colors.ink} onPress={() => router.replace('/')} size={24} />
          </ScrollView>
        </SafeAreaView>
      </SpeedLinesBackground>
    );
  }
  if (!data) return <SpeedLinesBackground><ActivityIndicator style={{ flex: 1 }} color={colors.ink} /></SpeedLinesBackground>;
  const booms = newBooms;
  if (boomStep !== null && boomStep < booms.length) {
    const b = booms[boomStep];
    return <MineBoom question={b.index} miners={b.miners ?? []}
      onDone={() => setBoomStep(boomStep + 1 < booms.length ? boomStep + 1 : null)} />;
  }

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

          {/* Détail des questions : le même récap pour tous les joueurs (réponse de chacun, bonne réponse, explication) */}
          <Text style={styles.qNum}>{R.recap}</Text>
          {data.questions.map((q) => {
            const mine = me?.answers?.find((a) => a.index === q.index);
            return (
              <Panel key={q.index} tilt={q.index % 2 ? 1 : -1} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.qNum}>Q{q.index + 1}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {q.mines > 0 && <><Bomb size={20} /><Text style={styles.small}>×{q.mines}</Text></>}
                    {mine && (
                      <Burst width={84} height={46} fill={mine.correct ? colors.green : colors.red} shape={BURST_B} shadow={2} outline={2}>
                        <Text style={[styles.small, { color: colors.white }]}>{mine.correct ? R.right : R.wrong} {R.points(mine.points)}</Text>
                      </Burst>
                    )}
                  </View>
                </View>
                <Text style={styles.text}>{q.prompt}</Text>
                <Text style={[styles.small, { color: colors.green }]}>{R.answerIs(q.choices[q.correct_index])}</Text>
                {data.players.map((p) => {
                  const a = p.answers?.find((x) => x.index === q.index);
                  const isMe = p.user_id === session?.user.id;
                  return (
                    <Text key={p.user_id} style={[styles.small, { color: a?.correct ? colors.green : colors.red }]}>
                      {a?.correct ? '✓' : '✗'} {isMe ? R.you : p.pseudo} : {a && a.choice !== null ? q.choices[a.choice] : R.noAnswer}
                      {a?.sure ? ` · ${t().duel.sure}` : ''}{p.mine === q.index ? ' · 💣' : ''}
                    </Text>
                  );
                })}
                {!!q.explanation && <Text style={[styles.small, { fontFamily: fonts.body }]}>{q.explanation}</Text>}
              </Panel>
            );
          })}

          <ComicButton label={t().mini.button} color={colors.blue} textColor={colors.yellow} size={26} onPress={miniGame} />
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
