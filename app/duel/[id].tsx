// Le duel : 5 questions, 15 secondes chacune, bouton SÛR ! après la question,
// mine à gauche avec sa bulle d'explication, VALIDER !
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bomb, Burst, ComicButton, Panel, SpeechBubble, SpeedLinesBackground } from '../../src/components/comic';
import { RULES } from '../../src/engine/rules';
import { t } from '../../src/i18n';
import { api, type BoostQuestion, type BoostResult, type MatchQuestions } from '../../src/lib/api';
import { BURST_B, colors, comicShadow, fonts } from '../../src/theme';
import { Alert } from '../../src/lib/alert';

const SECONDS = RULES.secondsPerQuestion;
const BOOST_SECONDS = 10;

export default function Duel() {
  const D = t().duel;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<MatchQuestions | null>(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [sure, setSure] = useState(false);
  const [mine, setMine] = useState<number | null>(null);
  const [left, setLeft] = useState<number>(SECONDS);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  // Boost : proposé après la 5e question s'il en reste cette semaine
  const [phase, setPhase] = useState<'questions' | 'boostOffer' | 'boost' | 'boostResult'>('questions');
  const [boostsLeft, setBoostsLeft] = useState(0);
  const [boostQ, setBoostQ] = useState<BoostQuestion | null>(null);
  const [boostRes, setBoostRes] = useState<BoostResult | null>(null);
  const [boostChoice, setBoostChoice] = useState<number | null>(null);
  const [boostSecs, setBoostSecs] = useState(BOOST_SECONDS);
  const startedAt = useRef(Date.now());
  const boostStarted = useRef(Date.now());
  const boostAnswered = useRef(false);

  useEffect(() => {
    api.matchQuestions(id).then((d) => {
      setData(d);
      setMine(d.my_mine);
      const first = [0, 1, 2, 3, 4].find((i) => !d.answered.includes(i));
      if (first === undefined) afterLastQuestion();
      else setIndex(first);
    }).catch((e: Error) => { Alert.alert(t().errors.generic, e.message); router.back(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Nouvelle question : on remet le chrono à zéro
  useEffect(() => {
    startedAt.current = Date.now();
    setLeft(SECONDS);
    setChoice(null);
    setSure(false);
  }, [index]);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      const revealed = await api.finish(id);
      api.notifyPlayers(id).catch(() => {});
      if (revealed) router.replace(`/reveal/${id}`);
      else setWaiting(true);
    } catch (e) {
      Alert.alert(t().errors.generic, (e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [id, router]);

  const submit = useCallback(async (timedOut = false) => {
    if (busy) return;
    setBusy(true);
    const ms = Date.now() - startedAt.current;
    try {
      await api.submitAnswer(id, index, timedOut ? null : choice, sure, ms);
      Haptics.impactAsync(sure ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (index >= 4) { setBusy(false); await afterLastQuestion(); return; }
      setIndex(index + 1);
    } catch (e) {
      Alert.alert(t().errors.generic, (e as Error).message);
    }
    setBusy(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, id, index, choice, sure, finish]);

  async function afterLastQuestion() {
    const n = await api.boostsLeft().catch(() => 0);
    if (n > 0) { setBoostsLeft(n); setPhase('boostOffer'); }
    else await finish();
  }

  async function startBoost() {
    setBusy(true);
    try {
      const q = await api.startBoost(id);
      setBoostQ(q);
      setBoostChoice(null);
      boostAnswered.current = false;
      boostStarted.current = Date.now();
      setBoostSecs(BOOST_SECONDS);
      setPhase('boost');
    } catch (e) {
      Alert.alert(t().errors.generic, (e as Error).message);
      await finish();
    }
    setBusy(false);
  }

  const answerBoost = useCallback(async (c: number | null) => {
    if (phase !== 'boost' || boostAnswered.current) return;
    boostAnswered.current = true;
    setBoostChoice(c);
    setBusy(true);
    try {
      const res = await api.submitBoost(id, c);
      setBoostRes(res);
      Haptics.notificationAsync(res.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPhase('boostResult');
    } catch (e) {
      Alert.alert(t().errors.generic, (e as Error).message);
      await finish();
    }
    setBusy(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, id]);

  // Chrono du Boost : 10 secondes
  useEffect(() => {
    if (phase !== 'boost') return;
    const timer = setInterval(() => {
      const remaining = BOOST_SECONDS - Math.floor((Date.now() - boostStarted.current) / 1000);
      setBoostSecs(Math.max(0, remaining));
      if (remaining <= 0) { clearInterval(timer); answerBoost(null); }
    }, 250);
    return () => clearInterval(timer);
  }, [phase, answerBoost]);

  // Chrono de 15 secondes ; à zéro, la question compte comme fausse
  useEffect(() => {
    if (!data || waiting || phase !== 'questions') return;
    const timer = setInterval(() => {
      const remaining = SECONDS - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) { clearInterval(timer); submit(true); }
    }, 250);
    return () => clearInterval(timer);
  }, [data, index, waiting, submit, phase]);

  async function toggleMine() {
    try {
      if (mine === index) { await api.removeMine(id); setMine(null); }
      else if (mine === null) { await api.placeMine(id, index); setMine(index); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); }
    } catch (e) { Alert.alert(t().errors.generic, (e as Error).message); }
  }

  if (!data) return <SpeedLinesBackground><ActivityIndicator style={{ flex: 1 }} color={colors.ink} /></SpeedLinesBackground>;

  if (waiting) {
    return (
      <SpeedLinesBackground>
        <SafeAreaView style={[styles.wrap, { justifyContent: 'center' }]}>
          <Burst width={320} height={240} fill={colors.skyDeep} shape={BURST_B} rotate={-4}>
            <Text style={[styles.burstText, { fontSize: 34, textAlign: 'center' }]}>{D.waiting}</Text>
          </Burst>
          <Panel><Text style={styles.prompt}>{D.waitingText}</Text></Panel>
          <ComicButton label="OK" onPress={() => router.replace('/')} />
        </SafeAreaView>
      </SpeedLinesBackground>
    );
  }

  if (phase !== 'questions') {
    return (
      <SpeedLinesBackground cy={25}>
        <SafeAreaView style={styles.wrap}>
          <Burst width={250} height={170} fill={colors.blue} shape={BURST_B} rotate={-5} style={{ alignSelf: 'center' }}>
            <Text style={[styles.burstText, { fontSize: 44 }]}>{phase === 'boostResult' ? (boostRes?.correct ? D.boostWin : D.boostLose) : D.boost}</Text>
          </Burst>

          {phase === 'boostOffer' && (
            <>
              <Panel tilt={-1} style={{ gap: 8 }}>
                <Text style={styles.mineTitle}>{D.boostTitle}</Text>
                <Text style={styles.prompt}>{D.boostOffer}</Text>
                <Text style={styles.rule}>{D.boostLeft(boostsLeft)}</Text>
              </Panel>
              <ComicButton label={D.boostGo} size={34} color={colors.blue} textColor={colors.yellow} disabled={busy} onPress={startBoost} />
              <Pressable onPress={finish} disabled={busy} accessibilityRole="button">
                <Text style={[styles.rule, { textDecorationLine: 'underline', fontSize: 15 }]}>{D.boostNo}</Text>
              </Pressable>
            </>
          )}

          {phase !== 'boostOffer' && boostQ && (
            <>
              {phase === 'boost' && (
                <View style={[styles.timer, comicShadow(3)]}>
                  <View style={[styles.timerFill, { width: `${(boostSecs / BOOST_SECONDS) * 100}%`, backgroundColor: colors.blue }]} />
                </View>
              )}
              <Panel tilt={-1}><Text style={styles.prompt}>{boostQ.prompt}</Text></Panel>
              <View style={styles.grid}>
                {boostQ.choices.map((c, i) => {
                  const right = phase === 'boostResult' && boostRes?.correct_index === i;
                  const wrongPick = phase === 'boostResult' && boostChoice === i && !boostRes?.correct;
                  return (
                    <Pressable key={i} disabled={phase !== 'boost' || busy} onPress={() => answerBoost(i)}
                      accessibilityRole="button"
                      style={[styles.answer, comicShadow(4), right && { backgroundColor: colors.green }, wrongPick && styles.answerOn]}>
                      <Text style={[styles.answerText, (right || wrongPick) && { color: colors.white }]} numberOfLines={2} adjustsFontSizeToFit>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {phase === 'boostResult' && (
                <>
                  {!!boostRes?.explanation && <Text style={styles.rule}>{boostRes.explanation}</Text>}
                  <ComicButton label={D.finishBtn} size={30} disabled={busy} onPress={finish} />
                </>
              )}
            </>
          )}
        </SafeAreaView>
      </SpeedLinesBackground>
    );
  }

  const q = data.questions[index];
  const mineHere = mine === index;
  const mineElsewhere = mine !== null && mine !== index;

  return (
    <SpeedLinesBackground cy={30}>
      <SafeAreaView style={styles.wrap}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} style={[styles.pill, comicShadow(3)]} accessibilityRole="button">
            <Text style={styles.pillText}>{D.quit}</Text>
          </Pressable>
          <Text style={styles.counter}>{D.question(index + 1)}</Text>
          <Burst width={56} height={56} fill={colors.red} shape={BURST_B} shadow={0} outline={2}>
            <Text style={[styles.burstText, { fontSize: 22 }]}>{left} S</Text>
          </Burst>
        </View>
        <View style={[styles.timer, comicShadow(3)]}>
          <View style={[styles.timerFill, { width: `${(left / SECONDS) * 100}%` }]} />
        </View>

        <Panel tilt={-1} style={{ marginTop: 10, paddingTop: 26 }}>
          <View style={[styles.themeTag, comicShadow(3)]}>
            <Text style={styles.themeText}>{data.theme.toUpperCase()}{data.card_multiplier === 2 ? ` · ${D.cardMatch}` : ''}</Text>
          </View>
          <View style={styles.promptRow}>
            <Text style={[styles.prompt, { flex: 1 }]}>{q.prompt}</Text>
            <Pressable
              onPress={() => setSure((s) => !s)}
              accessibilityRole="switch" accessibilityState={{ checked: sure }}
              accessibilityLabel={`${D.sure} ${D.surePts}`}
              style={{ transform: [{ rotate: sure ? '-8deg' : '0deg' }, { scale: sure ? 1.12 : 1 }], opacity: sure ? 1 : 0.85 }}
            >
              <Burst width={98} height={80} fill={colors.pink} shadow={4} outline={2}>
                <Text style={styles.sure}>{D.sure}</Text>
                <Text style={styles.surePts}>{D.surePts}</Text>
              </Burst>
            </Pressable>
          </View>
        </Panel>

        <View style={styles.grid}>
          {q.choices.map((c, i) => {
            const on = choice === i;
            return (
              <Pressable
                key={i} onPress={() => setChoice(i)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                style={[styles.answer, comicShadow(on ? 6 : 4), on && styles.answerOn]}
              >
                <Text style={[styles.answerText, on && { color: colors.yellow }]} numberOfLines={2} adjustsFontSizeToFit>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.mineRow}>
          <Pressable
            onPress={toggleMine} disabled={mineElsewhere}
            accessibilityRole="switch" accessibilityState={{ checked: mineHere, disabled: mineElsewhere }}
            accessibilityLabel={D.mineTitle}
            style={{ transform: [{ rotate: mineHere ? '-8deg' : '4deg' }, { scale: mineHere ? 1.08 : 1 }], opacity: mineElsewhere ? 0.45 : 1 }}
          >
            <Burst width={128} height={84} fill={mineHere ? colors.yellow : colors.red} shadow={4} outline={2}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Bomb size={30} />
                <Text style={[styles.burstText, { fontSize: 21, color: mineHere ? colors.red : colors.yellow }]}>
                  {mineHere ? D.mined : D.mine}
                </Text>
              </View>
            </Burst>
          </Pressable>
          <SpeechBubble tail="left" style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.mineTitle}>{D.mineTitle}</Text>
            <Text style={styles.mineRule}>{mineElsewhere ? D.mineUsed((mine ?? 0) + 1) : D.mineRule}</Text>
          </SpeechBubble>
        </View>

        <Text style={styles.rule}>{D.normalRule}</Text>

        <View style={{ marginTop: 'auto' }}>
          <ComicButton label={D.validate} size={34} disabled={choice === null || busy} onPress={() => submit(false)} />
        </View>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3 },
  pillText: { fontFamily: fonts.comic, fontSize: 17, letterSpacing: 1 },
  counter: { fontFamily: fonts.comic, fontSize: 20, letterSpacing: 1.5 },
  burstText: { fontFamily: fonts.comic, color: colors.yellow, letterSpacing: 1,
    textShadowColor: colors.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  timer: { height: 16, borderWidth: 3, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.white, overflow: 'hidden' },
  timerFill: { height: '100%', backgroundColor: colors.red, borderRightWidth: 3, borderColor: colors.ink },
  themeTag: { position: 'absolute', top: -18, left: 14, backgroundColor: colors.red, borderWidth: 3, borderColor: colors.ink,
    paddingHorizontal: 14, paddingVertical: 2, transform: [{ rotate: '-4deg' }] },
  themeText: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1.5, color: colors.yellow },
  promptRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  prompt: { fontFamily: fonts.bodyHeavy, fontSize: 24, lineHeight: 29, color: colors.ink },
  sure: { fontFamily: fonts.boom, fontSize: 22, color: colors.paleYellow, transform: [{ skewX: '-10deg' }],
    textShadowColor: colors.ink, textShadowOffset: { width: 2, height: 3 }, textShadowRadius: 0 },
  surePts: { fontFamily: fonts.comic, fontSize: 12, color: colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  answer: { width: '47%', minHeight: 58, borderWidth: 3, borderColor: colors.ink, borderRadius: 12, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  answerOn: { backgroundColor: colors.red, transform: [{ rotate: '-3deg' }, { scale: 1.04 }] },
  answerText: { fontFamily: fonts.comic, fontSize: 24, letterSpacing: 1, textAlign: 'center', color: colors.ink },
  mineRow: { flexDirection: 'row', alignItems: 'center' },
  mineTitle: { fontFamily: fonts.comic, fontSize: 18, letterSpacing: 0.5 },
  mineRule: { fontFamily: fonts.bodyHeavy, fontSize: 11 },
  rule: { fontFamily: fonts.bodyBold, fontSize: 12, textAlign: 'center' },
});
