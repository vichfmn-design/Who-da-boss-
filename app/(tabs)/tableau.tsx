// Le tableau : DUO (score exact + titres entre vous), GROUPE, GÉNÉRAL (classement mondial).
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CardBeams, SpeedLinesBackground, Star, WackyTitle } from '../../src/components/comic';
import { getLang, t } from '../../src/i18n';
import { api, type TitleRow } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { colors, comicShadow, fonts } from '../../src/theme';

type Tab = 'duo' | 'group' | 'global';
type Option = { id: string; label: string };
type ScoreRow = { userId: string; pseudo: string; points: number; wins: number };

const MAIN_TITLES = ['most_sure_correct', 'most_sure_wrong', 'longest_streak_month', 'most_minigame_records', 'most_mine_hits', 'most_mines_dodged'] as const;

export default function Board() {
  const B = t().board;
  const { session } = useSession();
  const me = session?.user.id;
  const [tab, setTab] = useState<Tab>('duo');
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [rank, setRank] = useState<{ rank: number | null; pct: number | null; total: number } | null>(null);
  const [themeNames, setThemeNames] = useState<Record<string, string>>({});
  const [showCats, setShowCats] = useState(false);

  useEffect(() => {
    supabase.from('themes').select('slug, name_fr, name_en').eq('active', true).order('sort').then(({ data }) => {
      const map: Record<string, string> = {};
      for (const th of (data ?? []) as { slug: string; name_fr: string; name_en: string }[]) {
        map[th.slug] = getLang() === 'en' ? th.name_en : th.name_fr;
      }
      setThemeNames(map);
    });
  }, []);

  // Liste des duos ou des groupes selon l'onglet
  const loadOptions = useCallback(async () => {
    if (!me) return;
    if (tab === 'duo') {
      const { data } = await supabase.from('connections')
        .select('id, a:profiles!connections_user_a_fkey(id, pseudo), b:profiles!connections_user_b_fkey(id, pseudo)');
      const opts = ((data ?? []) as unknown as { id: string; a: { id: string; pseudo: string }; b: { id: string; pseudo: string } }[])
        .map((c) => ({ id: c.id, label: (c.a.id === me ? c.b : c.a).pseudo }));
      setOptions(opts);
      setSelected((s) => (s && opts.some((o) => o.id === s) ? s : opts[0]?.id ?? null));
    } else if (tab === 'group') {
      const { data } = await supabase.from('groups').select('id, name');
      const opts = ((data ?? []) as { id: string; name: string }[]).map((g) => ({ id: g.id, label: g.name }));
      setOptions(opts);
      setSelected((s) => (s && opts.some((o) => o.id === s) ? s : opts[0]?.id ?? null));
    } else {
      setOptions([]);
      setSelected(null);
    }
  }, [tab, me]);
  useFocusEffect(useCallback(() => { loadOptions(); }, [loadOptions]));

  useEffect(() => {
    (async () => {
      if (tab === 'global') {
        setScores([]);
        setRank(await api.globalRank().catch(() => null));
        setTitles(await api.titles('global').catch(() => []));
        return;
      }
      if (!selected) { setScores([]); setTitles([]); return; }
      // Classement serveur : points des parties + points de Boost
      const rows = await api.standings(tab === 'duo' ? selected : undefined, tab === 'group' ? selected : undefined).catch(() => []);
      setScores(rows.map((r) => ({ userId: r.user_id, pseudo: r.pseudo, points: r.points, wins: r.wins })));
      setTitles(await api.titles(tab, selected).catch(() => []));
    })();
  }, [tab, selected]);

  const holderOf = (key: string) => titles.find((x) => x.title_key === key);
  const themeTitles = titles.filter((x) => x.title_key.startsWith('theme_boss:'));
  const who = (row?: TitleRow) => (!row ? B.nobody : row.holder === me ? B.you : row.profiles?.pseudo ?? '?');

  return (
    <SpeedLinesBackground cy={0}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.wrap}>

          <View style={styles.tabs}>
            {(['duo', 'group', 'global'] as Tab[]).map((k) => (
              <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
                style={[styles.tab, comicShadow(tab === k ? 5 : 3), tab === k && styles.tabOn]}>
                <Text style={[styles.tabText, tab === k && { color: colors.yellow }]}>{B[k]}</Text>
              </Pressable>
            ))}
          </View>

          {options.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {options.map((o) => (
                <Pressable key={o.id} onPress={() => setSelected(o.id)}
                  style={[styles.chip, selected === o.id && { backgroundColor: colors.ink }]}>
                  <Text style={[styles.chipText, selected === o.id && { color: colors.yellow }]}>{o.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {tab === 'global' ? (
            <View style={[styles.world, comicShadow(5)]}>
              <Text style={[styles.cardTitle, { color: colors.yellow }]}>{B.worldRank}</Text>
              {rank?.rank ? (
                <Text style={styles.worldRank}>{`${rank.rank}e / ${rank.total} · ${rank.pct} %`}</Text>
              ) : (
                <Text style={[styles.small, { color: colors.white }]}>{B.notRanked}</Text>
              )}
            </View>
          ) : (
            scores.length > 0 && (
              <View style={[styles.scores, comicShadow(6)]}>
                <CardBeams dir={1} />
                {scores.map((s, i) => {
                  const mine = s.userId === me;
                  return (
                    <View key={s.userId} style={[styles.scoreRow, i > 0 && { borderTopWidth: 2 }, mine && { backgroundColor: colors.red }]}>
                      <Text style={[styles.rank, mine && { color: colors.yellow }]}>{i + 1}</Text>
                      <Text style={[styles.name, mine && { color: colors.yellow }]}>{mine ? B.you : s.pseudo.toUpperCase()}</Text>
                      <Text style={[styles.small, mine && { color: colors.white }]}>{s.wins} ★</Text>
                      <Text style={[styles.points, mine && { color: colors.yellow }]}>{s.points}</Text>
                    </View>
                  );
                })}
              </View>
            )
          )}

          <WackyTitle text={B.titles} size={42} />
          <View style={[styles.titles, comicShadow(5)]}>
            <CardBeams dir={3} />
            {MAIN_TITLES.map((key) => {
              const row = holderOf(key);
              return (
                <View key={key} style={styles.titleRow}>
                  <Star size={18} fill={row?.holder === me ? colors.red : colors.ink} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.titleName}>{t().titles[key]}</Text>
                    <Text style={styles.titleInfo}>{t().titleInfo[key]}</Text>
                  </View>
                  <Text style={[styles.holder, row?.holder === me && styles.holderMe]}>{who(row)}</Text>
                </View>
              );
            })}

            <Pressable onPress={() => setShowCats((v) => !v)} accessibilityRole="button"
              accessibilityState={{ expanded: showCats }} style={[styles.titleRow, showCats && styles.catOpen]}>
              <Star size={18} fill={themeTitles.some((x) => x.holder === me) ? colors.red : colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={styles.titleName}>{t().titleInfo.categories}</Text>
                <Text style={styles.titleInfo}>{t().titleInfo.categoriesInfo}</Text>
              </View>
              <Text style={styles.chevron}>{showCats ? '▲' : '▼'}</Text>
            </Pressable>
            {showCats && Object.entries(themeNames).map(([slug, name]) => {
              const row = themeTitles.find((x) => x.title_key === `theme_boss:${slug}`);
              return (
                <View key={slug} style={[styles.titleRow, styles.subRow]}>
                  <Star size={14} fill={row?.holder === me ? colors.red : colors.ink} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.titleName, { fontSize: 16 }]}>{t().titles.theme_boss(name)}</Text>
                    <Text style={styles.titleInfo}>{t().titleInfo.themeInfo(name)}</Text>
                  </View>
                  <Text style={[styles.holder, row?.holder === me && styles.holderMe]}>{who(row)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.titleInfo}>{t().titleInfo.steal}</Text>
        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14, paddingBottom: 110 },
  tabs: { flexDirection: 'row', gap: 10 },
  tab: { flex: 1, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 12, paddingVertical: 6, alignItems: 'center' },
  tabOn: { backgroundColor: colors.red, transform: [{ rotate: '-2deg' }] },
  tabText: { fontFamily: fonts.comic, fontSize: 21, letterSpacing: 1, color: colors.ink },
  chip: { borderWidth: 3, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: colors.white },
  chipText: { fontFamily: fonts.comic, fontSize: 17, letterSpacing: 1 },
  world: { backgroundColor: colors.ink, borderRadius: 14, padding: 14, gap: 4 },
  worldRank: { fontFamily: fonts.comic, fontSize: 34, color: colors.white, letterSpacing: 1 },
  scores: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, overflow: 'hidden' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 4, borderColor: colors.ink },
  rank: { fontFamily: fonts.comic, fontSize: 20, width: 16 },
  name: { flex: 1, fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1 },
  points: { fontFamily: fonts.comic, fontSize: 28 },
  cardTitle: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1 },
  titles: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 2, borderColor: colors.ink },
  titleName: { fontFamily: fonts.comic, fontSize: 18, letterSpacing: 0.5 },
  titleInfo: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.grey },
  catOpen: { backgroundColor: colors.paleYellow },
  subRow: { paddingLeft: 26, backgroundColor: '#FFFDF0' },
  chevron: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.ink, paddingHorizontal: 4 },
  holder: { fontFamily: fonts.comic, fontSize: 15, borderWidth: 2, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 8,
    overflow: 'hidden', backgroundColor: colors.red, color: colors.yellow },
  holderMe: { backgroundColor: colors.red, color: colors.yellow },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#D0D0D0', paddingBottom: 2 },
  small: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink },
});
