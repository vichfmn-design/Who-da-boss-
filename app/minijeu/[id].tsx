// Mini-jeu bonus de fin de partie (facultatif) : le même pour tous les joueurs de la partie.
// Le meilleur score gagne 1 point bonus vers la carte Who da Boss ?
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bomb, Burst, ComicButton, Panel, SpeedLinesBackground } from '../../src/components/comic';
import { t } from '../../src/i18n';
import { Alert } from '../../src/lib/alert';
import { api, type BoostContent, type BoostGame, type BoostInfo } from '../../src/lib/api';
import { BURST_B, colors, comicShadow, fonts } from '../../src/theme';

const EMOJIS = ['💣', '⭐', '🔥', '💥', '🎯', '👑'];
type Submit = (payload: Record<string, unknown>) => void;

export default function MiniJeuScreen() {
  const B = t().boost;
  const M = t().mini;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<BoostInfo | null>(null);
  const [content, setContent] = useState<BoostContent | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.getBoost(id).then(setInfo).catch((e: Error) => { Alert.alert(t().errors.generic, e.message); router.back(); });
  }, [id, router]);
  useEffect(() => { load(); }, [load]);

  async function start() {
    setBusy(true);
    try { setContent((await api.startBoostGame(id)).content); }
    catch (e) { Alert.alert(t().errors.generic, (e as Error).message); load(); }
    setBusy(false);
  }

  const submit: Submit = async (payload) => {
    setBusy(true);
    try {
      await api.submitBoostGame(id, payload);
      setContent(null);
      load();
    } catch (e) { Alert.alert(t().errors.generic, (e as Error).message); }
    setBusy(false);
  };

  if (!info) return <SpeedLinesBackground><ActivityIndicator style={{ flex: 1 }} color={colors.ink} /></SpeedLinesBackground>;
  const game = info.game;
  const playing = !!content && !info.me?.finished && info.status === 'open';

  return (
    <SpeedLinesBackground cy={20}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <Pressable onPress={() => router.back()} style={[styles.pill, comicShadow(3)]} accessibilityRole="button">
              <Text style={styles.pillText}>{B.back}</Text>
            </Pressable>
            <Text style={styles.counter}>{B.short[game]}</Text>
          </View>

          <Burst width={300} height={180} fill={colors.yellow} glow="#FFF6B0" stroke={colors.red} outline={4} shadow={7}
            rotate={-5} style={{ alignSelf: 'center' }}>
            <Text style={styles.boostTitle}>{M.title}</Text>
            <Text style={styles.boostSub}>{B.short[game]}</Text>
          </Burst>

          {playing ? (
            <Game game={game} content={content!} busy={busy} onSubmit={submit} />
          ) : info.status === 'closed' ? (
            <Results info={info} />
          ) : info.me?.finished ? (
            <Panel tilt={-1} style={{ gap: 8 }}>
              <Text style={styles.title}>{B.played}</Text>
              {!!info.me.display && <Text style={styles.text}>{B.yourScore(info.me.display)}</Text>}
              <Text style={styles.small}>{B.waiting}</Text>
              <Players info={info} />
            </Panel>
          ) : (
            <>
              <Panel tilt={-1} style={{ gap: 8 }}>
                <Text style={styles.small}>{M.intro}</Text>
                <Text style={styles.text}>{B.howto[game]}</Text>
              </Panel>
              <ComicButton label={B.start} size={32} color={colors.blue} textColor={colors.yellow} disabled={busy} onPress={start} />
              <Players info={info} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

function Players({ info }: { info: BoostInfo }) {
  const B = t().boost;
  return (
    <View style={{ gap: 4 }}>
      {info.players.map((p) => (
        <Text key={p.pseudo} style={styles.small}>
          {p.me ? B.you.toUpperCase() : p.pseudo} · {p.finished ? (p.display ?? '✓') : B.notPlayed}
        </Text>
      ))}
    </View>
  );
}

function Results({ info }: { info: BoostInfo }) {
  const B = t().boost;
  const M = t().mini;
  return (
    <Panel tilt={-1} style={{ gap: 10 }}>
      <Text style={styles.title}>{B.results}</Text>
      {info.winner
        ? <Text style={styles.text}>{info.winner_is_me ? M.winnerMe : M.winner(info.winner)}</Text>
        : <Text style={styles.text}>{B.noWinner}</Text>}
      {info.answer !== null && <Text style={styles.small}>{B.answer(info.answer.toLocaleString('fr-FR'), '')}</Text>}
      {info.players.map((p, i) => (
        <View key={p.pseudo} style={[styles.resultRow, i === 0 && info.winner && { backgroundColor: colors.yellow }]}>
          <Text style={styles.resultName}>{i + 1}. {p.me ? B.you.toUpperCase() : p.pseudo.toUpperCase()}</Text>
          <Text style={styles.small}>{p.display ?? B.notPlayed}</Text>
          {p.points > 0 && <Text style={styles.resultPts}>+{p.points}</Text>}
        </View>
      ))}
    </Panel>
  );
}

function Game({ game, content, busy, onSubmit }: { game: BoostGame; content: BoostContent; busy: boolean; onSubmit: Submit }) {
  switch (game) {
    case 'frappe': return <Frappe content={content} busy={busy} onSubmit={onSubmit} />;
    case 'rebus': return <Rebus content={content} busy={busy} onSubmit={onSubmit} />;
    case 'chiffre': return <Chiffre content={content} busy={busy} onSubmit={onSubmit} />;
    case 'reflexe': return <Reflexe content={content} onSubmit={onSubmit} />;
    case 'memoire': return <Memoire content={content} onSubmit={onSubmit} />;
    default: return <Chrono onSubmit={onSubmit} />;
  }
}

// 1. Frappe éclair : le chrono tourne côté serveur depuis « JE JOUE ! »
function Frappe({ content, busy, onSubmit }: { content: BoostContent; busy: boolean; onSubmit: Submit }) {
  const B = t().boost;
  const [text, setText] = useState('');
  return (
    <>
      <Panel tilt={-1}><Text style={styles.big}>{content.text}</Text></Panel>
      <TextInput style={[styles.input, { height: 90 }]} multiline autoFocus value={text} onChangeText={setText}
        placeholder={B.typeHere} autoCorrect={false} autoCapitalize="none" spellCheck={false} accessibilityLabel={B.typeHere} />
      <ComicButton label={B.send} size={28} disabled={busy || text.trim().length === 0} onPress={() => onSubmit({ text })} />
    </>
  );
}

// 2. Rébus emoji : 5 rébus à la suite
function Rebus({ content, busy, onSubmit }: { content: BoostContent; busy: boolean; onSubmit: Submit }) {
  const items = content.items ?? [];
  const [i, setI] = useState(0);
  const answers = useRef<number[]>([]);
  const item = items[i];
  if (!item) return null;
  const pick = (c: number) => {
    answers.current[i] = c;
    if (i + 1 >= items.length) onSubmit({ answers: answers.current });
    else setI(i + 1);
  };
  return (
    <>
      <Text style={styles.counter}>{`${i + 1} / ${items.length}`}</Text>
      <Panel tilt={-1}><Text style={styles.emoji}>{item.emoji}</Text></Panel>
      <View style={{ gap: 10 }}>
        {item.choices.map((c, k) => (
          <Pressable key={`${i}-${k}`} disabled={busy} onPress={() => pick(k)} accessibilityRole="button" style={[styles.answer, comicShadow(4)]}>
            <Text style={styles.answerText}>{c}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

// 3. Le juste chiffre
function Chiffre({ content, busy, onSubmit }: { content: BoostContent; busy: boolean; onSubmit: Submit }) {
  const B = t().boost;
  const [value, setValue] = useState('');
  const n = Number(value.replace(/\s/g, '').replace(',', '.'));
  return (
    <>
      <Panel tilt={-1}><Text style={styles.big}>{content.q}</Text></Panel>
      <View style={styles.inline}>
        <TextInput style={[styles.input, { flex: 1, fontSize: 26 }]} keyboardType="decimal-pad" autoFocus value={value}
          onChangeText={setValue} placeholder={B.yourGuess} accessibilityLabel={B.yourGuess} />
        {!!content.unit && <Text style={styles.title}>{content.unit}</Text>}
      </View>
      <ComicButton label={B.send} size={28} disabled={busy || value.trim() === '' || Number.isNaN(n)} onPress={() => onSubmit({ value: n })} />
    </>
  );
}

// 4. Réflexe : 3 essais, moyenne des temps de réaction ; un faux départ = essai raté
function Reflexe({ content, onSubmit }: { content: BoostContent; onSubmit: Submit }) {
  const B = t().boost;
  const delays = content.delays ?? [2000, 3000, 2500];
  const [tryN, setTryN] = useState(0);
  const [state, setState] = useState<'ready' | 'wait' | 'boom' | 'early'>('ready');
  const times = useRef<number[]>([]);
  const boomAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const begin = () => {
    setState('wait');
    timer.current = setTimeout(() => { boomAt.current = Date.now(); setState('boom'); }, delays[tryN] ?? 2000);
  };
  const tap = () => {
    if (state === 'ready') return begin();
    if (state === 'wait') {
      if (timer.current) clearTimeout(timer.current);
      setState('early');
      setTimeout(() => onSubmit({ ms: 0 }), 900);
      return;
    }
    if (state === 'boom') {
      times.current.push(Date.now() - boomAt.current);
      if (tryN + 1 >= 3) {
        onSubmit({ ms: Math.round(times.current.reduce((a, b) => a + b, 0) / times.current.length) });
      } else { setTryN(tryN + 1); setState('ready'); }
    }
  };
  return (
    <>
      <Text style={styles.counter}>{B.tryN(Math.min(tryN + 1, 3))}</Text>
      <Pressable onPressIn={tap} accessibilityRole="button"
        style={[styles.zone, comicShadow(6), { backgroundColor: state === 'boom' ? colors.red : state === 'early' ? colors.grey : colors.white }]}>
        {state === 'boom'
          ? <Burst width={220} height={170} fill={colors.yellow} shape={BURST_B}><Text style={[styles.burstText, { color: colors.red }]}>{B.tap}</Text></Burst>
          : <>
              <Bomb size={90} />
              <Text style={styles.title}>{state === 'ready' ? B.go : state === 'wait' ? B.wait : B.tooEarly}</Text>
            </>}
      </Pressable>
    </>
  );
}

// 5. Mémoire : la suite s'allonge d'un emoji à chaque tour réussi
function Memoire({ content, onSubmit }: { content: BoostContent; onSubmit: Submit }) {
  const B = t().boost;
  const seq = content.sequence ?? [];
  const [len, setLen] = useState(3);
  const [phase, setPhase] = useState<'show' | 'input'>('show');
  const [shown, setShown] = useState(-1);
  const [pos, setPos] = useState(0);

  // Chaque emoji s'affiche 550 ms puis disparaît 250 ms : un emoji répété clignote, on peut le compter
  useEffect(() => {
    if (phase !== 'show') return;
    let k = 0;
    let tm: ReturnType<typeof setTimeout>;
    setShown(-1);
    const step = () => {
      if (k >= len) { setShown(-1); setPhase('input'); setPos(0); return; }
      setShown(k);
      tm = setTimeout(() => { setShown(-1); k += 1; tm = setTimeout(step, 400); }, 600);
    };
    tm = setTimeout(step, 400);
    return () => clearTimeout(tm);
  }, [phase, len]);

  const press = (e: number) => {
    if (phase !== 'input') return;
    if (seq[pos] !== e) { onSubmit({ level: len - 1 }); return; }
    if (pos + 1 >= len) {
      if (len >= seq.length) { onSubmit({ level: len }); return; }
      setLen(len + 1); setPhase('show');
    } else setPos(pos + 1);
  };
  return (
    <>
      <Text style={styles.counter}>{B.level(len)} · {phase === 'show' ? B.watch : B.yourTurn}</Text>
      <Panel tilt={-1} style={{ alignItems: 'center', minHeight: 110, justifyContent: 'center' }}>
        {phase === 'show' && shown >= 0 ? (
          // Nouvel élément à chaque affichage (key) + numéro : un emoji répété réapparaît bien
          <View key={`m${shown}`} style={{ alignItems: 'center' }}>
            <Text style={styles.memo}>{EMOJIS[seq[shown]]}</Text>
            <Text style={styles.memoNum}>{shown + 1} / {len}</Text>
          </View>
        ) : (
          <Text style={styles.memo}>{phase === 'show' ? ' ' : `${pos} / ${len}`}</Text>
        )}
      </Panel>
      <View style={styles.memoGrid}>
        {EMOJIS.map((e, k) => (
          <Pressable key={e} disabled={phase !== 'input'} onPress={() => press(k)} accessibilityRole="button"
            style={[styles.memoKey, comicShadow(4), phase !== 'input' && { opacity: 0.5 }]}>
            <Text style={styles.memoKeyText}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

// 6. Le chrono parfait : visible 3 s, puis caché ; viser 10,00 s
function Chrono({ onSubmit }: { onSubmit: Submit }) {
  const B = t().boost;
  const [running, setRunning] = useState(false);
  const [ms, setMs] = useState(0);
  const startAt = useRef(0);
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setMs(Date.now() - startAt.current), 30);
    return () => clearInterval(iv);
  }, [running]);
  const press = () => {
    if (!running) { startAt.current = Date.now(); setMs(0); setRunning(true); return; }
    setRunning(false);
    onSubmit({ ms: Date.now() - startAt.current });
  };
  const visible = !running || ms < 3000;
  return (
    <>
      <Panel tilt={-1} style={{ alignItems: 'center' }}>
        <Text style={styles.chrono}>{visible ? (ms / 1000).toFixed(2).replace('.', ',') : '?,??'}</Text>
        <Text style={styles.small}>🎯 10,00 s</Text>
      </Panel>
      <ComicButton label={running ? B.stop : B.go} size={36} color={running ? colors.red : colors.blue}
        textColor={colors.yellow} onPress={press} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 16, paddingBottom: 40 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3 },
  pillText: { fontFamily: fonts.comic, fontSize: 17, letterSpacing: 1 },
  counter: { fontFamily: fonts.comic, fontSize: 20, letterSpacing: 1.5, textAlign: 'center' },
  burstText: { fontFamily: fonts.comic, fontSize: 30, color: colors.yellow, textAlign: 'center', letterSpacing: 1,
    textShadowColor: colors.ink, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  title: { fontFamily: fonts.comic, fontSize: 26, letterSpacing: 1, color: colors.ink },
  boostTitle: { fontFamily: fonts.comic, fontSize: 54, letterSpacing: 1, color: colors.red,
    textShadowColor: colors.ink, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  boostSub: { fontFamily: fonts.comic, fontSize: 18, letterSpacing: 0.5, color: colors.ink, marginTop: -4 },
  text: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.ink },
  big: { fontFamily: fonts.bodyHeavy, fontSize: 22, lineHeight: 28, color: colors.ink },
  small: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink },
  input: { borderWidth: 3, borderColor: colors.ink, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: fonts.bodyBold, fontSize: 18, backgroundColor: colors.white },
  inline: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  emoji: { fontSize: 64, textAlign: 'center' },
  answer: { borderWidth: 3, borderColor: colors.ink, borderRadius: 12, backgroundColor: colors.white, paddingVertical: 12, paddingHorizontal: 10 },
  answerText: { fontFamily: fonts.comic, fontSize: 20, letterSpacing: 0.5, textAlign: 'center', color: colors.ink },
  zone: { height: 320, borderWidth: 4, borderColor: colors.ink, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 12 },
  memo: { fontSize: 72, fontFamily: fonts.comic },
  memoNum: { fontFamily: fonts.comic, fontSize: 16, letterSpacing: 1, color: colors.grey },
  memoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  memoKey: { width: '29%', aspectRatio: 1, borderWidth: 3, borderColor: colors.ink, borderRadius: 16, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center' },
  memoKeyText: { fontSize: 44 },
  chrono: { fontFamily: fonts.comic, fontSize: 80, letterSpacing: 2, color: colors.ink },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: colors.ink, borderRadius: 10, padding: 8 },
  resultName: { flex: 1, fontFamily: fonts.comic, fontSize: 18, letterSpacing: 0.5 },
  resultPts: { fontFamily: fonts.comic, fontSize: 22, color: colors.green },
});
