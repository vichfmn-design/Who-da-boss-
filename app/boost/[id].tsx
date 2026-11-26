// Boost : série dans la catégorie choisie. 9 s par question, +2 points par bonne réponse,
// ça continue tant qu'on répond juste ; à la première erreur (ou temps écoulé), la série s'arrête.
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Burst, ComicButton, Panel, SpeedLinesBackground } from '../../src/components/comic';
import { t } from '../../src/i18n';
import { Alert } from '../../src/lib/alert';
import { api, type BoostRunState } from '../../src/lib/api';
import { colors, comicShadow, fonts } from '../../src/theme';

const SECONDS = 9;

export default function BoostRun() {
  const B = t().boost;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<BoostRunState | null>(null);
  const [lastQuestion, setLastQuestion] = useState<BoostRunState['question']>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const [flash, setFlash] = useState(false);
  const busy = useRef(false);
  const startedAt = useRef(Date.now());

  const apply = useCallback((r: BoostRunState, elapsedMs = 0) => {
    setRun(r);
    if (r.question) {
      setLastQuestion(r.question);
      setPicked(null);
      startedAt.current = Date.now() - elapsedMs;
      setLeft(Math.max(0, SECONDS - Math.floor(elapsedMs / 1000)));
    }
  }, []);

  useEffect(() => {
    api.getBoostRun(id).then((r) => apply(r, r.elapsed_ms ?? 0))
      .catch((e: Error) => { Alert.alert(t().errors.generic, e.message); router.back(); });
  }, [id, apply, router]);

  const answer = useCallback(async (choice: number | null) => {
    if (busy.current || !run || run.ended) return;
    busy.current = true;
    setPicked(choice);
    try {
      const r = await api.answerBoostRun(id, choice);
      if (r.correct) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setFlash(true);
        setTimeout(() => setFlash(false), 600);
        apply(r);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setRun(r);
      }
    } catch (e) { Alert.alert(t().errors.generic, (e as Error).message); }
    busy.current = false;
  }, [id, run, apply]);

  // Chrono de 9 secondes : à zéro, la série s'arrête
  useEffect(() => {
    if (!run || run.ended) return;
    const timer = setInterval(() => {
      const remaining = SECONDS - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) { clearInterval(timer); answer(null); }
    }, 200);
    return () => clearInterval(timer);
  }, [run, answer]);

  if (!run) return <SpeedLinesBackground><ActivityIndicator style={{ flex: 1 }} color={colors.ink} /></SpeedLinesBackground>;
  const q = run.ended ? lastQuestion : run.question;

  return (
    <SpeedLinesBackground cy={18}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap}>
          <View style={styles.top}>
            <Text style={styles.counter}>{run.theme?.toUpperCase()}</Text>
            <View style={[styles.score, comicShadow(3)]}>
              <Text style={styles.scoreText}>+{run.points} PTS · {B.streak(run.streak)}</Text>
            </View>
          </View>

          <View style={{ alignItems: 'center' }}>
            <Burst width={250} height={150} fill={colors.yellow} glow="#FFF6B0" stroke={colors.red} outline={4} shadow={7} rotate={-5}>
              <Text style={styles.boostTitle}>{flash ? B.plus2 : run.ended ? B.runOver : B.title}</Text>
            </Burst>
          </View>

          {!run.ended && (
            <View style={[styles.timer, comicShadow(3)]}>
              <View style={[styles.timerFill, { width: `${(left / SECONDS) * 100}%` }]} />
            </View>
          )}

          {q && (
            <>
              <Panel tilt={-1}><Text style={styles.prompt}>{q.prompt}</Text></Panel>
              <View style={styles.grid}>
                {q.choices.map((c, i) => {
                  const right = run.ended && run.correct_index === i;
                  const wrong = run.ended && picked === i && run.correct_index !== i;
                  return (
                    <Pressable key={`${q.prompt}-${i}`} disabled={!!run.ended} onPress={() => answer(i)} accessibilityRole="button"
                      style={[styles.answer, comicShadow(4), right && { backgroundColor: colors.green }, wrong && { backgroundColor: colors.red }]}>
                      <Text style={[styles.answerText, (right || wrong) && { color: colors.white }]} numberOfLines={2}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {run.ended && (
            <>
              {!!run.explanation && <Text style={styles.small}>{run.explanation}</Text>}
              <Panel tilt={1}>
                <Text style={styles.total}>{run.streak > 0 ? B.runTotal(run.streak, run.points) : B.runZero}</Text>
              </Panel>
              <ComicButton label={B.finish} size={30} onPress={() => router.replace('/rivaux')} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14, paddingBottom: 40 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontFamily: fonts.comic, fontSize: 20, letterSpacing: 1 },
  score: { backgroundColor: colors.red, borderWidth: 2, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  scoreText: { fontFamily: fonts.comic, fontSize: 16, letterSpacing: 0.5, color: colors.yellow },
  boostTitle: { fontFamily: fonts.comic, fontSize: 48, letterSpacing: 1, color: colors.red, textAlign: 'center',
    textShadowColor: colors.ink, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  timer: { height: 16, borderWidth: 3, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.white, overflow: 'hidden' },
  timerFill: { height: '100%', backgroundColor: colors.red, borderRightWidth: 3, borderColor: colors.ink },
  prompt: { fontFamily: fonts.bodyHeavy, fontSize: 22, lineHeight: 28, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  answer: { width: '47%', minHeight: 58, borderWidth: 3, borderColor: colors.ink, borderRadius: 12, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  answerText: { fontFamily: fonts.comic, fontSize: 20, letterSpacing: 0.5, textAlign: 'center', color: colors.ink },
  small: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  total: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 0.5, color: colors.ink, textAlign: 'center' },
});
