// Rivaux : défier un ami en duo, créer un groupe, ajouter des amis (rival existant ou lien par message),
// rythme, signaler / bloquer. Toutes les actions sont des boutons visibles (pas d'appui long caché).
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AlertButton } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ComicButton, ComicTitle, SpeedLinesBackground } from '../../src/components/comic';
import { t } from '../../src/i18n';
import { Alert } from '../../src/lib/alert';
import { api, type MyBoosts } from '../../src/lib/api';
import { extractInviteCode, inviteUrl } from '../../src/lib/links';
import { useSession } from '../../src/lib/session';
import { shareText } from '../../src/lib/share';
import { supabase } from '../../src/lib/supabase';
import { colors, comicShadow, fonts } from '../../src/theme';

type Rival = { connectionId: string; userId: string; pseudo: string; rhythm: number };
type Member = { userId: string; pseudo: string };
type Group = { id: string; name: string; rhythm: number; members: Member[]; createdBy: string | null };

const MAX_GROUP = 8;

export default function Rivals() {
  const R = t().rivals;
  const { session } = useSession();
  const me = session?.user.id;
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [code, setCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);
  const [boosts, setBoosts] = useState<MyBoosts>({ tokens: [], challenges: [] });
  const router = useRouter();

  const load = useCallback(async () => {
    if (!me) return;
    api.myBoosts().then(setBoosts).catch(() => {});
    const { data: conns } = await supabase
      .from('connections')
      .select('id, rhythm_days, a:profiles!connections_user_a_fkey(id, pseudo), b:profiles!connections_user_b_fkey(id, pseudo)');
    setRivals(((conns ?? []) as unknown as {
      id: string; rhythm_days: number; a: { id: string; pseudo: string }; b: { id: string; pseudo: string };
    }[]).map((c) => {
      const other = c.a.id === me ? c.b : c.a;
      return { connectionId: c.id, userId: other.id, pseudo: other.pseudo, rhythm: c.rhythm_days };
    }));

    const { data: gs } = await supabase
      .from('groups').select('id, name, rhythm_days, created_by, group_members(user_id, profiles(pseudo))').order('created_at');
    setGroups(((gs ?? []) as unknown as {
      id: string; name: string; rhythm_days: number; created_by: string | null;
      group_members: { user_id: string; profiles: { pseudo: string } | null }[];
    }[]).map((g) => ({
      id: g.id, name: g.name, rhythm: g.rhythm_days, createdBy: g.created_by,
      members: g.group_members.map((m) => ({ userId: m.user_id, pseudo: m.profiles?.pseudo ?? '?' })),
    })));
  }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fail = (e: unknown) => Alert.alert(t().errors.generic, (e as Error).message);

  // Boost du duo / groupe : jetons disponibles et défi en cours
  const B = t().boost;
  const tokensFor = (c?: string, g?: string) =>
    boosts.tokens.find((x) => (c && x.connection_id === c) || (g && x.group_id === g))?.count ?? 0;
  const openFor = (c?: string, g?: string) =>
    boosts.challenges.find((x) => x.status === 'open' && ((c && x.connection_id === c) || (g && x.group_id === g)));
  function launch(c?: string, g?: string) {
    Alert.alert(B.title, B.launchConfirm, [
      { text: R.cancel, style: 'cancel' },
      { text: B.launch, onPress: () => {
          api.launchBoost(c, g).then((id) => router.push(`/boost/${id}`)).catch(fail);
        } },
    ]);
  }
  function BoostButton({ c, g }: { c?: string; g?: string }) {
    const open = openFor(c, g);
    if (open) {
      return <ComicButton label={open.i_finished ? B.pending : B.play} size={18} color={colors.blue} textColor={colors.yellow}
        onPress={() => router.push(`/boost/${open.id}`)} style={{ marginTop: 8 }} />;
    }
    const n = tokensFor(c, g);
    if (n === 0) return null;
    return <ComicButton label={`${B.have(n)} · ${B.launch}`} size={18} color={colors.blue} textColor={colors.yellow}
      onPress={() => launch(c, g)} style={{ marginTop: 8 }} />;
  }

  // Duo : un lien unique à envoyer par message (Messages, WhatsApp…)
  async function inviteDuo() {
    setBusy(true);
    try {
      const c = await api.createInvite();
      await shareText(R.inviteShare(inviteUrl(c)));
    } catch (e) { fail(e); }
    setBusy(false);
  }

  async function sendGroupLink(g: Group) {
    try {
      const c = await api.createInvite(g.id);
      await shareText(R.groupShare(g.name, inviteUrl(c)));
    } catch (e) { fail(e); }
  }

  // Ajouter au groupe : un rival existant en un geste, ou un lien pour quelqu'un de nouveau
  function addToGroup(g: Group) {
    const inGroup = new Set(g.members.map((m) => m.userId));
    const candidates = rivals.filter((r) => !inGroup.has(r.userId));
    const buttons: AlertButton[] = [
      ...candidates.slice(0, MAX_GROUP - g.members.length).map((r) => ({
        text: `+ ${r.pseudo}`,
        onPress: () => {
          api.addToGroup(g.id, r.userId)
            .then(() => { Alert.alert(R.added(r.pseudo)); load(); })
            .catch(fail);
        },
      })),
      { text: R.sendLink, onPress: () => { sendGroupLink(g); } },
      { text: R.cancel, style: 'cancel' },
    ];
    Alert.alert(R.addTitle(g.name), R.addHow, buttons);
  }

  async function createGroup() {
    setBusy(true);
    try {
      const id = await api.createGroup(groupName.trim());
      const created: Group = { id, name: groupName.trim(), rhythm: 1, createdBy: me ?? null, members: me ? [{ userId: me, pseudo: '' }] : [] };
      setGroupName('');
      await load();
      Alert.alert(R.groupCreated, undefined, [
        { text: R.addFriend, onPress: () => addToGroup(created) },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (e) { fail(e); }
    setBusy(false);
  }

  async function join() {
    setBusy(true);
    try {
      const res = await api.acceptInvite(extractInviteCode(code));
      setCode('');
      await load();
      Alert.alert(res.group_id ? R.joinedGroup : R.joinedDuo, res.group_name ?? undefined);
    } catch (e) { fail(e); }
    setBusy(false);
  }

  function changeRhythm(r: { connectionId?: string; groupId?: string }) {
    Alert.alert(R.rhythmTitle, R.rhythmInfo, [
      ...[1, 2, 3, 7].map((d) => ({
        text: R.rhythm(d),
        onPress: () => { api.setRhythm(d, r.connectionId, r.groupId).then(load).catch(fail); },
      })),
      { text: R.cancel, style: 'cancel' as const },
    ]);
  }

  // Règle Apple 1.2 : signaler et bloquer un joueur
  function rivalOptions(r: Rival) {
    Alert.alert(r.pseudo, R.rhythm(r.rhythm), [
      { text: R.changeRhythm, onPress: () => changeRhythm({ connectionId: r.connectionId }) },
      { text: R.report, onPress: () => { supabase.from('reports').insert({ reporter: me, reported_user: r.userId }).then(() => {}); } },
      { text: R.deleteDuo, style: 'destructive', onPress: () => confirm(R.deleteDuoConfirm(r.pseudo),
          () => api.deleteConnection(r.connectionId)) },
      { text: R.block, style: 'destructive', onPress: async () => {
          await supabase.from('blocks').insert({ blocker: me, blocked: r.userId });
          await supabase.from('connections').delete().eq('id', r.connectionId);
          load();
        } },
      { text: R.cancel, style: 'cancel' },
    ]);
  }

  // Confirmation avant une action qui efface quelque chose
  function confirm(message: string, action: () => Promise<unknown>) {
    Alert.alert(R.options, message, [
      { text: R.cancel, style: 'cancel' },
      { text: R.confirm, style: 'destructive', onPress: () => { action().then(load).catch(fail); } },
    ]);
  }

  // Options d'un groupe : rythme, ajouter, retirer (créateur), quitter, supprimer (créateur)
  function groupOptions(g: Group) {
    const isCreator = g.createdBy === me;
    const others = g.members.filter((m) => m.userId !== me);
    const buttons: AlertButton[] = [
      { text: R.changeRhythm, onPress: () => changeRhythm({ groupId: g.id }) },
    ];
    if (g.members.length < MAX_GROUP) buttons.push({ text: R.addFriend, onPress: () => addToGroup(g) });
    if (isCreator && others.length > 0) {
      buttons.push({ text: R.removeMember, onPress: () => {
        Alert.alert(R.removeWho, undefined, [
          ...others.map((m) => ({ text: m.pseudo, onPress: () => confirm(R.removeConfirm(m.pseudo),
            () => api.removeFromGroup(g.id, m.userId)) })),
          { text: R.cancel, style: 'cancel' as const },
        ]);
      } });
    }
    buttons.push({ text: R.leaveGroup, style: 'destructive', onPress: () => confirm(R.leaveConfirm(g.name), () => api.leaveGroup(g.id)) });
    if (isCreator) {
      buttons.push({ text: R.deleteGroup, style: 'destructive', onPress: () => confirm(R.deleteGroupConfirm(g.name), () => api.deleteGroup(g.id)) });
    }
    buttons.push({ text: R.cancel, style: 'cancel' });
    Alert.alert(g.name, R.members(g.members.length), buttons);
  }

  return (
    <SpeedLinesBackground cy={0}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <ComicTitle size={40}>{R.title}</ComicTitle>

          <ComicButton label={R.invite} onPress={inviteDuo} disabled={busy} size={26} />
          <Text style={styles.hint}>{R.howTo}</Text>

          {rivals.length === 0 && groups.length === 0 && <Text style={styles.text}>{R.none}</Text>}

          {rivals.length > 0 && <Text style={styles.section}>{R.duos}</Text>}
          {rivals.map((r) => (
            <View key={r.connectionId} style={[styles.card, styles.duoCard, comicShadow(4)]}>
              <Pressable onPress={() => rivalOptions(r)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.pseudo.toUpperCase()}</Text>
                  <Text style={styles.sub}>{R.rhythm(r.rhythm)}</Text>
                </View>
                <Text style={styles.more}>•••</Text>
              </Pressable>
              <BoostButton c={r.connectionId} />
            </View>
          ))}

          <Text style={styles.section}>{R.groups}</Text>
          {groups.map((g) => {
            const full = g.members.length >= MAX_GROUP;
            return (
              <View key={g.id} style={[styles.card, styles.groupCard, comicShadow(4)]}>
                <Pressable onPress={() => groupOptions(g)} accessibilityRole="button" style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.name, { color: colors.yellow, flex: 1 }]}>{g.name.toUpperCase()}</Text>
                    <Text style={[styles.more, { color: colors.yellow }]}>•••</Text>
                  </View>
                  <Text style={[styles.sub, { color: colors.white }]}>
                    {g.members.map((m) => `${m.userId === me ? t().board.you : m.pseudo}${m.userId === g.createdBy ? ` (${R.creator})` : ''}`).join(', ')}
                  </Text>
                  <Text style={[styles.sub, { color: colors.white }]}>{R.members(g.members.length)} · {R.rhythm(g.rhythm)}</Text>
                  {g.members.length < 2 && <Text style={[styles.sub, { color: colors.yellow }]}>{R.waitingMembers}</Text>}
                </Pressable>
                <ComicButton label={full ? R.full : R.addFriend} disabled={full} onPress={() => addToGroup(g)}
                  color={colors.yellow} textColor={colors.ink} size={20} style={{ marginTop: 6 }} />
                <BoostButton g={g.id} />
              </View>
            );
          })}

          <View style={styles.inline}>
            <TextInput style={styles.input} placeholder={R.groupName} value={groupName} onChangeText={setGroupName}
              maxLength={30} accessibilityLabel={R.groupName} />
            <ComicButton label={R.group} onPress={createGroup} disabled={busy || groupName.trim().length < 2} size={18}
              color={colors.blue} textColor={colors.white} style={{ paddingHorizontal: 10 }} />
          </View>

          <View style={styles.inline}>
            <TextInput style={styles.input} placeholder={R.haveCode} value={code} onChangeText={setCode}
              autoCapitalize="none" autoCorrect={false} accessibilityLabel={R.haveCode} />
            <ComicButton label={R.join} onPress={join} disabled={busy || extractInviteCode(code).length < 6} size={20}
              style={{ paddingHorizontal: 14 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14, paddingBottom: 32 },
  text: { fontFamily: fonts.bodyBold, fontSize: 15 },
  hint: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: 6 },
  section: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1, marginTop: 6 },
  card: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, padding: 12,
    flexDirection: 'row', alignItems: 'center' },
  groupCard: { backgroundColor: colors.red, flexDirection: 'column', alignItems: 'stretch' },
  duoCard: { flexDirection: 'column', alignItems: 'stretch' },
  name: { fontFamily: fonts.comic, fontSize: 24, letterSpacing: 1 },
  sub: { fontFamily: fonts.bodyBold, fontSize: 12 },
  more: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 2, paddingHorizontal: 6 },
  inline: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, borderWidth: 3, borderColor: colors.ink, borderRadius: 12, paddingHorizontal: 12, height: 50,
    fontFamily: fonts.bodyBold, fontSize: 15, backgroundColor: colors.white },
});
