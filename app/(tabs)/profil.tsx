// Profil : titres détenus, points bonus et cartes, langue, déconnexion, suppression du compte.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bomb, Burst, ComicButton, SpeedLinesBackground } from '../../src/components/comic';
import { pickSelfie } from '../../src/lib/selfie';
import { uploadSelfie, useSelfieUrl } from '../../src/lib/selfieUrl';
import { getLang, t } from '../../src/i18n';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { api, type MyStats } from '../../src/lib/api';
import { StatsDashboard } from '../../src/components/StatsDashboard';
import { colors, comicShadow, fonts } from '../../src/theme';
import { Alert } from '../../src/lib/alert';


export default function ProfileScreen() {
  const P = t().profile;
  const { profile, session, refreshProfile } = useSession();
  const router = useRouter();
  const [cards, setCards] = useState(0);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const selfieUrl = useSelfieUrl(profile?.mine_selfie);

  // Selfie de mine : photo prise avec l'appareil avant, envoyée dans l'espace privé du jeu
  async function takeSelfie() {
    if (!session) return;
    const blob = await pickSelfie();
    if (!blob) { if (Platform.OS !== 'web') Alert.alert(P.mine, P.selfieWeb); return; }
    setUploading(true);
    try {
      await uploadSelfie(session.user.id, blob, profile?.mine_selfie);
      await refreshProfile();
      Alert.alert(P.mine, P.selfieSaved);
    } catch (e) { Alert.alert(t().errors.generic, (e as Error).message); }
    setUploading(false);
  }

  const load = useCallback(async () => {
    if (!session) return;
    const { count } = await supabase.from('cards').select('id', { count: 'exact', head: true })
      .is('used_at', null).gt('expires_at', new Date().toISOString());
    setCards(count ?? 0);
    api.myStats().then(setStats).catch(() => {});
    refreshProfile();
  }, [session, refreshProfile]);
  useFocusEffect(useCallback(() => { load(); }, [load]));


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

  // Carte Who da Boss ? : choisir l'adversaire (rival ou groupe), puis le thème ; le défi démarre aussitôt.
  async function playCard() {
    if (!session) return;
    const card = await api.myCard();
    if (!card) { load(); return; }
    const me = session.user.id;
    const { data: conns } = await supabase.from('connections')
      .select('id, a:profiles!connections_user_a_fkey(id, pseudo), b:profiles!connections_user_b_fkey(id, pseudo)');
    const { data: gs } = await supabase.from('groups').select('id, name');
    const targets = [
      ...((conns ?? []) as unknown as { id: string; a: { id: string; pseudo: string }; b: { id: string; pseudo: string } }[])
        .map((c) => ({ label: (c.a.id === me ? c.b : c.a).pseudo, connectionId: c.id as string | undefined, groupId: undefined as string | undefined })),
      ...((gs ?? []) as { id: string; name: string }[]).map((g) => ({ label: g.name, connectionId: undefined, groupId: g.id })),
    ];
    if (targets.length === 0) return Alert.alert(P.playCard, P.cardNoRival);
    const until = new Date(card.expires_at).toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    Alert.alert(P.cardWho, P.cardUntil(until), [
      ...targets.map((tg) => ({ text: tg.label, onPress: () => { chooseTheme(card.id, tg.connectionId, tg.groupId); } })),
      { text: P.cancel, style: 'cancel' as const },
    ]);
  }

  async function chooseTheme(cardId: string, connectionId?: string, groupId?: string) {
    const { data } = await supabase.from('themes').select('slug, name_fr, name_en').eq('active', true).order('sort');
    const themes = (data ?? []) as { slug: string; name_fr: string; name_en: string }[];
    Alert.alert(P.cardTheme, undefined, [
      ...themes.map((th) => ({
        text: getLang() === 'en' ? th.name_en : th.name_fr,
        onPress: () => {
          api.playCard(cardId, th.slug, connectionId, groupId)
            .then((matchId) => router.push(`/duel/${matchId}`))
            .catch((e: Error) => Alert.alert(t().errors.generic, e.message));
        },
      })),
      { text: P.cancel, style: 'cancel' as const },
    ]);
  }


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
          {cards > 0 && (
            <ComicButton label={P.playCard} color={colors.blue} textColor={colors.yellow} onPress={playCard} size={26} />
          )}

          <StatsDashboard stats={stats} />

          <Text style={styles.section}>{P.mine}</Text>
          <View style={[styles.mineCard, comicShadow(5)]}>
            <View style={styles.selfieRing}>
              {selfieUrl
                ? <Image source={{ uri: selfieUrl }} style={styles.selfie} accessibilityLabel={P.mine} />
                : <Bomb size={56} />}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.small}>{P.mineInfo}</Text>
              <ComicButton label={profile?.mine_selfie ? P.changeSelfie : P.takeSelfie} size={18} disabled={uploading}
                onPress={takeSelfie} style={{ paddingHorizontal: 8 }} />
            </View>
          </View>


          <ComicButton label={P.rules} color={colors.yellow} textColor={colors.ink} onPress={() => router.push('/regles?from=profil')} size={24} />
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
  wrap: { padding: 20, gap: 14, paddingBottom: 110 },
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
  mineCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderWidth: 3,
    borderColor: colors.ink, borderRadius: 14, padding: 12 },
  selfieRing: { width: 92, height: 92, borderRadius: 46, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.paleYellow,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  selfie: { width: '100%', height: '100%' },
  delete: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.red, textAlign: 'center', textDecorationLine: 'underline' },
});
