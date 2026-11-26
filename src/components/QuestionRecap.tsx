// Profil : récap des questions vues, par thème (dépliable). La bonne réponse s'affiche
// une fois la partie révélée (tout le monde a joué).
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { api, type RecapTheme } from '../lib/api';
import { colors, comicShadow, fonts } from '../theme';
import { CardBeams, Star } from './comic';

export function QuestionRecap({ refreshKey }: { refreshKey?: number }) {
  const Q = t().recap;
  const [themes, setThemes] = useState<RecapTheme[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { api.questionRecap().then(setThemes).catch(() => setThemes([])); }, [refreshKey]);
  if (!themes || themes.length === 0) return null;

  return (
    <>
      <Text style={styles.section}>{Q.title}</Text>
      <View style={[styles.card, comicShadow(5)]}>
        <CardBeams dir={4} />
        {themes.map((th, i) => {
          const isOpen = open === th.slug;
          return (
            <View key={th.slug} style={i > 0 && styles.sep}>
              <Pressable onPress={() => setOpen(isOpen ? null : th.slug)} accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }} style={[styles.row, isOpen && styles.rowOpen]}>
                <Star size={16} fill={th.correct * 2 >= th.total ? colors.red : colors.ink} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.theme}>{th.name.toUpperCase()}</Text>
                  <Text style={styles.count}>{Q.count(th.correct, th.total)}</Text>
                </View>
                <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
              </Pressable>
              {isOpen && th.questions.map((q, k) => (
                <View key={k} style={styles.q}>
                  <Text style={styles.prompt}>{q.prompt}</Text>
                  <Text style={[styles.small, { color: q.correct ? colors.green : colors.red }]}>
                    {q.correct ? '✓' : '✗'} {q.mine ?? Q.noAnswer}
                  </Text>
                  {!q.correct && (
                    <Text style={styles.small}>{q.answer ? Q.answer(q.answer) : Q.hidden}</Text>
                  )}
                  {!!q.explanation && <Text style={styles.expl}>{q.explanation}</Text>}
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1 },
  card: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, overflow: 'hidden' },
  sep: { borderTopWidth: 2, borderColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  rowOpen: { backgroundColor: colors.yellow },
  theme: { fontFamily: fonts.comic, fontSize: 19, letterSpacing: 0.5 },
  count: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.grey },
  chevron: { fontFamily: fonts.comic, fontSize: 20 },
  q: { paddingHorizontal: 14, paddingVertical: 8, gap: 3, borderTopWidth: 1, borderColor: '#E3E3E3' },
  prompt: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink },
  small: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  expl: { fontFamily: fonts.body, fontSize: 12, color: colors.grey },
});
