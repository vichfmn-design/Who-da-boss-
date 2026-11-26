// Le duel : 5 questions, 15 secondes chacune, bouton SÛR ! après la question,
// mine à gauche avec sa bulle d'explication, VALIDER !
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelfieUrl } from '../../src/lib/selfieUrl';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Bomb, Burst, ComicButton, Panel, SpeechBubble, SpeedLinesBackground } from '../../src/components/comic';
import { RULES } from '../../src/engine/rules';
import { t } from '../../src/i18n';
import { api, type MatchQuestions } from '../../src/lib/api';
import { BURST_B, colors, comicShadow, fonts } from '../../src/theme';
import { Alert } from '../../src/lib/alert';

const SECONDS = RULES.secondsPerQuestion;

/** Le selfie de celui qui a posé la mine, sous le BOOM (bombe si pas de selfie). */
function MinerSelfie({ pseudo, path }: { pseudo: string; path: string | null }) {
  const url = useSelfieUrl(path);
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={[{ width: 120, height: 120, borderRadius: 60, borderWidth: 5, borderColor: colors.ink, backgroundColor: colors.white,
        overflow: 'hidden', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] }, comicShadow(5)]}>
        {url ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} accessibilityLabel={pseudo} /> : <Bomb size={64} />}
      </View>
      <View style={{ backgroundColor: colors.ink, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999 }}>
        <Text style={{ fontFamily: fonts.comic, fontSize: 18, letterSpacing: 0.5, color: colors.yellow }}>{t().duel.trapBy(pseudo)}</Text>
      </View>
    </View>
  );
}

/** Petit nuage BD (blanc, contour noir) autour de l'explosion de mine. */
function Cloud({ style }: { style?: object }) {
  const bumps = [[30, 52, 24], [62, 36, 30], [96, 50, 24], [64, 60, 22]] as const;
  return (
    <View style={style} pointerEvents="none">
      <Svg width={130} height={86} viewBox="0 0 130 86">
        {bumps.map(([cx, cy, r], i) => <Circle key={`o${i}`} cx={cx} cy={cy} r={r + 3.5} fill={colors.ink} />)}
        {bumps.map(([cx, cy, r], i) => <Circle key={`i${i}`} cx={cx} cy={cy} r={r} fill={colors.white} />)}
      </Svg>
    </View>
  );
}

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
  // « BOOM ! Une mine vient d'exploser ! » : mauvaise réponse sur une question minée par un rival
  const [boom, setBoom] = useState<number | null>(null);
  const [miners, setMiners] = useState<{ pseudo: string; selfie: string | null }[]>([]);
  const afterBoom = useRef<(() => void) | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    api.matchQuestions(id).then((d) => {
      setData(d);
      setMine(d.my_mine);
      const first = [0, 1, 2, 3, 4].find((i) => !d.answered.includes(i));
      if (first === undefined) finish();
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
      const res = await api.submitAnswer(id, index, timedOut ? null : choice, sure, ms);
      Haptics.impactAsync(sure ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const next = () => { if (index >= 4) finish(); else setIndex(index + 1); };
      if (res?.mine_hit) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        afterBoom.current = next;
        setMiners(res.miners ?? []);
        setBoom(res.mines);
        setBusy(false);
        return;
      }
      if (index >= 4) { setBusy(false); await finish(); return; }
      setIndex(index + 1);
    } catch (e) {
      Alert.alert(t().errors.generic, (e as Error).message);
    }
    setBusy(false);
  }, [busy, id, index, choice, sure, finish]);

  // L'explosion reste 2,5 s (ou jusqu'au toucher), puis question suivante
  const continueAfterBoom = useCallback(() => {
    const go = afterBoom.current;
    afterBoom.current = null;
    setBoom(null);
    go?.();
  }, []);
  useEffect(() => {
    if (boom === null) return;
    const tm = setTimeout(continueAfterBoom, 2500);
    return () => clearTimeout(tm);
  }, [boom, continueAfterBoom]);

  // Chrono de 15 secondes ; à zéro, la question compte comme fausse
  useEffect(() => {
    if (!data || waiting || boom !== null) return;
    const timer = setInterval(() => {
      const remaining = SECONDS - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) { clearInterval(timer); submit(true); }
    }, 250);
    return () => clearInterval(timer);
  }, [data, index, waiting, submit, boom]);

  async function toggleMine() {
    try {
      if (mine === index) { await api.removeMine(id); setMine(null); }
      else if (mine === null) { await api.placeMine(id, index); setMine(index); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); }
    } catch (e) { Alert.alert(t().errors.generic, (e as Error).message); }
  }

  if (!data) return <SpeedLinesBackground><ActivityIndicator style={{ flex: 1 }} color={colors.ink} /></SpeedLinesBackground>;

  if (boom !== null) {
    return (
      <Pressable style={{ flex: 1 }} onPress={continueAfterBoom} accessibilityRole="button" accessibilityLabel={D.mineBoomSub}>
        <SpeedLinesBackground>
          <SafeAreaView style={[styles.wrap, { justifyContent: 'center', alignItems: 'center' }]}>
            <View style={{ width: 340, height: 330, alignItems: 'center', justifyContent: 'center' }}>
              <Burst width={330} height={320} fill={colors.red} glow={colors.redLight} shadow={9} outline={4}>
                <Text style={styles.boomText}>{D.mineBoom}</Text>
                <View style={[styles.boomLabel, comicShadow(4)]}>
                  <Text style={styles.boomLabelText}>{D.mineBoomSub}</Text>
                </View>
              </Burst>
              <Cloud style={{ position: 'absolute', top: -6, left: -14 }} />
              <Cloud style={{ position: 'absolute', top: 0, right: -14 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: -24 }}>
              {miners.map((m) => <MinerSelfie key={m.pseudo} pseudo={m.pseudo} path={m.selfie} />)}
            </View>
            <Panel tilt={1}><Text style={styles.rule}>{D.mineBoomLoss(boom)}</Text></Panel>
            <Text style={styles.rule}>{D.tapToContinue}</Text>
          </SafeAreaView>
        </SpeedLinesBackground>
      </Pressable>
    );
  }

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
  boomText: { fontFamily: fonts.boom, fontSize: 76, color: colors.yellow, transform: [{ rotate: '-6deg' }],
    textShadowColor: colors.ink, textShadowOffset: { width: 4, height: 5 }, textShadowRadius: 0 },
  boomLabel: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 4,
    transform: [{ rotate: '-4deg' }], marginTop: 6 },
  boomLabelText: { fontFamily: fonts.comic, fontSize: 18, letterSpacing: 0.5, color: colors.red },
});
