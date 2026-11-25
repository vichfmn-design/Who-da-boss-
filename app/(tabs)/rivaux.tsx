// Rivaux : connexions en duo, groupes, invitations, rythme, signaler / bloquer.
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ComicButton, ComicTitle, SpeedLinesBackground } from '../../src/components/comic';
import { t } from '../../src/i18n';
import { api } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { colors, comicShadow, fonts } from '../../src/theme';

type Rival = { connectionId: string; userId: string; pseudo: string; rhythm: number };
type Group = { id: string; name: string; rhythm: number; members: string[] };

export default function Rivals() {
  const R = t().rivals;
  const router = useRouter();
  const { session } = useSession();
  const me = session?.user.id;
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [code, setCode] = useState('');
  const [groupName, setGroupName] = useState('');

  const load = useCallback(async () => {
    if (!me) return;
    const { data: conns } = await supabase
      .from('connections')
      .select('id, rhythm_days, a:profiles!connections_user_a_fkey(id, pseudo), b:profiles!connections_user_b_fkey(id, pseudo)');
    setRivals(((conns ?? []) as unknown as {
      id: string; rhythm_days: number; a: { id: string; pseudo: string }; b: { id: string; pseudo: string };
    }[]).map((c) => {
      const other = c.a.id === me ? c.b : c.a;
      return { connectionId: c.id, userId: other.id, pseudo: other.pseudo, rhythm: c.rhythm_days };
    }));

    const { data: gs } = await supabase.from('groups').select('id, name, rhythm_days, group_members(profiles(pseudo))');
    setGroups(((gs ?? []) as unknown as {
      id: string; name: string; rhythm_days: number; group_members: { profiles: { pseudo: string } | null }[];
    }[]).map((g) => ({
      id: g.id, name: g.name, rhythm: g.rhythm_days,
      members: g.group_members.map((m) => m.profiles?.pseudo ?? '?'),
    })));
  }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function invite(groupId?: string) {
    try {
      const c = await api.createInvite(groupId);
      const url = Linking.createURL(`/invite/${c}`);
      await Share.share({ message: R.inviteShare(url) });
    } catch (e) { Alert.alert(t().errors.generic, (e as Error).message); }
  }

  async function join() {
    try { await api.acceptInvite(code); setCode(''); load(); }
    catch (e) { Alert.alert(t().errors.generic, (e as Error).message); }
  }

  async function createGroup() {
    try { const id = await api.createGroup(groupName.trim()); setGroupName(''); await load(); invite(id); }
    catch (e) { Alert.alert(t().errors.generic, (e as Error).message); }
  }

  function changeRhythm(r: { connectionId?: string; groupId?: string; current: number }) {
    const options = [1, 2, 3, 7];
    Alert.alert('Rythme', undefined, [
      ...options.map((d) => ({
        text: R.rhythm(d),
        onPress: () => api.setRhythm(d, r.connectionId, r.groupId).then(load)
          .catch((e: Error) => Alert.alert(t().errors.generic, e.message)),
      })),
      { text: t().profile.cancel, style: 'cancel' as const },
    ]);
  }

  // Règle Apple 1.2 : signaler et bloquer un joueur
  function moderate(r: Rival) {
    Alert.alert(r.pseudo, undefined, [
      { text: R.report, onPress: () => supabase.from('reports').insert({ reporter: me, reported_user: r.userId }).then(() => {}) },
      { text: R.block, style: 'destructive', onPress: async () => {
          await supabase.from('blocks').insert({ blocker: me, blocked: r.userId });
          await supabase.from('connections').delete().eq('id', r.connectionId);
          load();
        } },
      { text: t().profile.cancel, style: 'cancel' },
    ]);
  }

  return (
    <SpeedLinesBackground cy={0}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.wrap}>
          <ComicTitle size={40}>{R.title}</ComicTitle>

          {rivals.length === 0 && groups.length === 0 && <Text style={styles.text}>{R.none}</Text>}

          {rivals.map((r) => (
            <Pressable key={r.connectionId} onLongPress={() => moderate(r)} onPress={() => changeRhythm({ connectionId: r.connectionId, current: r.rhythm })}
              style={[styles.card, comicShadow(4)]} accessibilityHint={`${R.report} / ${R.block}`}>
              <Text style={styles.name}>{r.pseudo.toUpperCase()}</Text>
              <Text style={styles.sub}>{R.rhythm(r.rhythm)}</Text>
            </Pressable>
          ))}

          {groups.map((g) => (
            <Pressable key={g.id} onPress={() => changeRhythm({ groupId: g.id, current: g.rhythm })}
              onLongPress={() => invite(g.id)} style={[styles.card, styles.groupCard, comicShadow(4)]}>
              <Text style={[styles.name, { color: colors.yellow }]}>{g.name.toUpperCase()} · {g.members.length}/4</Text>
              <Text style={[styles.sub, { color: colors.white }]}>{g.members.join(', ')} · {R.rhythm(g.rhythm)}</Text>
            </Pressable>
          ))}

          <ComicButton label={R.invite} onPress={() => invite()} size={26} />

          <View style={styles.inline}>
            <TextInput style={styles.input} placeholder={R.haveCode} value={code} onChangeText={setCode}
              autoCapitalize="none" accessibilityLabel={R.haveCode} />
            <ComicButton label={R.join} onPress={join} disabled={code.trim().length < 6} size={20} style={{ paddingHorizontal: 14 }} />
          </View>

          <View style={styles.inline}>
            <TextInput style={styles.input} placeholder={R.groupName} value={groupName} onChangeText={setGroupName}
              maxLength={30} accessibilityLabel={R.groupName} />
            <ComicButton label={R.group} onPress={createGroup} disabled={groupName.trim().length < 2} size={18}
              color={colors.blue} textColor={colors.white} style={{ paddingHorizontal: 10 }} />
          </View>

          <Pressable onPress={() => router.push('/')}><Text style={styles.text}>‹ {t().tabs.play}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14, paddingBottom: 120 },
  text: { fontFamily: fonts.bodyBold, fontSize: 15 },
  card: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, padding: 12 },
  groupCard: { backgroundColor: colors.red },
  name: { fontFamily: fonts.comic, fontSize: 24, letterSpacing: 1 },
  sub: { fontFamily: fonts.bodyBold, fontSize: 12 },
  inline: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, borderWidth: 3, borderColor: colors.ink, borderRadius: 12, paddingHorizontal: 12, height: 50,
    fontFamily: fonts.bodyBold, fontSize: 15, backgroundColor: colors.white },
});
