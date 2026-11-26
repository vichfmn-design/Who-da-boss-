// Profil : titres détenus, points bonus et cartes, langue, déconnexion, suppression du compte.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Burst, ComicButton, Star, SpeedLinesBackground } from '../../src/components/comic';
import { setLang, t, type Lang } from '../../src/i18n';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { api } from '../../src/lib/api';
import { colors, comicShadow, fonts } from '../../src/theme';
import { Alert } from '../../src/lib/alert';

type HeldTitle = { title_key: string; scope: string; value: number };

export default function ProfileScreen() {
  const P = t().profile;
  const { profile, session, refreshProfile } = useSession();
  const [held, setHeld] = useState<HeldTitle[]>([]);
  const [cards, setCards] = useState(0);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from('title_holders').select('title_key, scope, value').eq('holder', session.user.id);
    setHeld((data as HeldTitle[]) ?? []);
    const { count } = await supabase.from('cards').select('id', { count: 'exact', head: true })
      .is('used_at', null).gt('expires_at', new Date().toISOString());
    setCards(count ?? 0);
    refreshProfile();
  }, [session, refreshProfile]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function changeLang(l: Lang) {
    if (!session) return;
    await supabase.from('profiles').update({ lang: l }).eq('id', session.user.id);
    setLang(l);
    refreshProfile();
  }

  function confirmDelete() {
    Alert.alert(P.delete, P.deleteConfirm, [
      { text: P.cancel, style: 'cancel' },
      { text: P.confirm, style: 'destructive', onPress: async () => {
          const { error } = await api.deleteAccount();
          if (error) return Alert.alert(t().errors.generic, error.message);
          await supabase.auth.signOut();
        } },
    ]);
  }

  const titleName = (key: string) => {
    if (key.startsWith('theme_boss:')) return t().titles.theme_boss(key.split(':')[1]);
    return (t().titles as Record<string, unknown>)[key] as string ?? key;
  };

  return (
    <SpeedLinesBackground cx={22} cy={8}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.wrap}>
          <View style={styles.header}>
            <Burst width={96} height={96} fill={colors.red} shadow={5}>
              <Text style={styles.letter}>{profile?.pseudo?.[0]?.toUpperCase() ?? '?'}</Text>
            </Burst>
            <View style={{ flex: 1 }}>
              <Text style={styles.pseudo}>{profile?.pseudo?.toUpperCase()}</Text>
              <Text style={styles.small}>{P.bonus(profile?.bonus_balance ?? 0)}</Text>
              <Text style={styles.small}>{P.cards(cards)}</Text>
            </View>
          </View>

          <Text style={styles.section}>{t().board.titles}</Text>
          <View style={styles.chips}>
            {held.length === 0 && <Text style={styles.small}>—</Text>}
            {held.map((h) => (
              <View key={`${h.scope}-${h.title_key}`} style={[styles.chip, comicShadow(3)]}>
                <Star size={16} fill={colors.red} />
                <Text style={styles.chipText}>{titleName(h.title_key)}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.section}>{P.language}</Text>
          <View style={styles.chips}>
            {(['fr', 'en'] as Lang[]).map((l) => (
              <Pressable key={l} onPress={() => changeLang(l)}
                style={[styles.chip, comicShadow(3), profile?.lang === l && { backgroundColor: colors.ink }]}>
                <Text style={[styles.chipText, profile?.lang === l && { color: colors.yellow }]}>{l === 'fr' ? 'FRANÇAIS' : 'ENGLISH'}</Text>
              </Pressable>
            ))}
          </View>

          <ComicButton label={P.logout} color={colors.ink} onPress={() => supabase.auth.signOut()} size={24} />
          <Pressable onPress={confirmDelete} accessibilityRole="button">
            <Text style={styles.delete}>{P.delete}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  letter: { fontFamily: fonts.comic, fontSize: 44, color: colors.yellow,
    textShadowColor: colors.ink, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  pseudo: { fontFamily: fonts.comic, fontSize: 40, color: colors.white, letterSpacing: 1.5,
    textShadowColor: colors.red, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  small: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.ink },
  section: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fonts.comic, fontSize: 15, letterSpacing: 0.5 },
  delete: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.red, textAlign: 'center', textDecorationLine: 'underline' },
});
