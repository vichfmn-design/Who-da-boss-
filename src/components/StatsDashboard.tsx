// Tableau de bord du profil : parties, % de victoires et de défaites, catégories, fun facts.
import { StyleSheet, Text, View } from 'react-native';
import { Star } from './comic';
import { getLang, t } from '../i18n';
import type { MyStats } from '../lib/api';
import { colors, comicShadow, fonts } from '../theme';

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const secs = (ms: number) => (ms / 1000).toLocaleString(getLang() === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 1 });

function Tile({ label, value, color = colors.white, textColor = colors.ink }: {
  label: string; value: string; color?: string; textColor?: string;
}) {
  return (
    <View style={[styles.tile, comicShadow(4), { backgroundColor: color }]}>
      <Text style={[styles.tileValue, { color: textColor }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.tileLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function StatsDashboard({ stats }: { stats: MyStats | null }) {
  const P = t().profile;
  if (!stats) return null;
  if (stats.played === 0) {
    return (
      <>
        <Text style={styles.section}>{P.stats}</Text>
        <Text style={styles.small}>{P.noStats}</Text>
      </>
    );
  }

  const winPct = pct(stats.wins, stats.played);
  const lossPct = pct(stats.losses, stats.played);
  const played = stats.themes.filter((th) => th.answered > 0);
  const ranked = [...played].sort((a, b) => pct(b.correct, b.answered) - pct(a.correct, a.answered));
  const F = P.fact;
  const facts: string[] = [];
  if (stats.favorite_rival) facts.push(F.favorite(stats.favorite_rival.pseudo, stats.favorite_rival.games));
  if (stats.nemesis) facts.push(F.nemesis(stats.nemesis.pseudo, stats.nemesis.they_won));
  if (stats.victim) facts.push(F.victim(stats.victim.pseudo, stats.victim.i_won));
  if (ranked.length > 0) facts.push(F.best(ranked[0].name, pct(ranked[0].correct, ranked[0].answered)));
  if (ranked.length > 1) {
    const w = ranked[ranked.length - 1];
    facts.push(F.worst(w.name, pct(w.correct, w.answered)));
  }
  if (stats.fastest_ms) facts.push(F.fastest(secs(stats.fastest_ms)));
  if (stats.avg_ms_correct) facts.push(F.avg(secs(stats.avg_ms_correct)));
  if (stats.sure_total > 0) facts.push(F.sure(pct(stats.sure_correct, stats.sure_total), stats.sure_total));
  if (stats.mines_triggered > 0) facts.push(F.minesTriggered(stats.mines_triggered));
  if (stats.mines_hit > 0) facts.push(F.minesHit(stats.mines_hit));
  if (stats.best_game !== null) facts.push(F.bestGame(stats.best_game));
  if (stats.best_streak > 1) facts.push(F.streak(stats.best_streak));
  if (stats.bonus_earned > 0) facts.push(F.bonus(stats.bonus_earned));

  return (
    <>
      <Text style={styles.section}>{P.stats}</Text>
      <View style={styles.grid}>
        <Tile label={P.played} value={String(stats.played)} />
        <Tile label={P.winPct} value={`${winPct} %`} color={colors.green} textColor={colors.white} />
        <Tile label={P.lossPct} value={`${lossPct} %`} color={colors.red} textColor={colors.yellow} />
        <Tile label={P.forfeits} value={String(stats.forfeits)} />
        <Tile label={P.seasonPoints} value={`${stats.season_points > 0 ? '+' : ''}${stats.season_points}`} color={colors.ink} textColor={colors.yellow} />
        <Tile label={P.accuracy} value={`${pct(stats.correct, stats.answered)} %`} color={colors.blue} textColor={colors.white} />
      </View>

      <Text style={styles.section}>{P.categories}</Text>
      <View style={[styles.card, comicShadow(5)]}>
        {stats.themes.map((th) => {
          const p = pct(th.correct, th.answered);
          return (
            <View key={th.slug} style={styles.themeRow}>
              <View style={styles.themeHead}>
                <Text style={styles.themeName}>{th.name}</Text>
                <Text style={styles.small}>{th.answered > 0 ? `${p} % · ${P.answers(th.answered)}` : '—'}</Text>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${p}%`, backgroundColor: p >= 60 ? colors.green : p >= 40 ? colors.yellowDeep : colors.red }]} />
              </View>
            </View>
          );
        })}
      </View>

      {facts.length > 0 && (
        <>
          <Text style={styles.section}>{P.funFacts}</Text>
          <View style={[styles.card, comicShadow(5), { gap: 8 }]}>
            {facts.map((f) => (
              <View key={f} style={styles.fact}>
                <View style={{ marginTop: 2 }}><Star size={16} fill={colors.red} /></View>
                <Text style={styles.factText}>{f}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1 },
  small: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '30%', flexGrow: 1, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 6,
    alignItems: 'center' },
  tileValue: { fontFamily: fonts.comic, fontSize: 30, letterSpacing: 1 },
  tileLabel: { fontFamily: fonts.bodyHeavy, fontSize: 11, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, padding: 12, gap: 10 },
  themeRow: { gap: 4 },
  themeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  themeName: { fontFamily: fonts.comic, fontSize: 17, letterSpacing: 0.5 },
  bar: { height: 12, borderWidth: 2, borderColor: colors.ink, borderRadius: 999, backgroundColor: '#F1F1F1', overflow: 'hidden' },
  barFill: { height: '100%' },
  fact: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  factText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19, color: colors.ink },
});
