// Lien d'invitation /invite/CODE : accepte le duel ou l'entrée dans le groupe, puis ouvre Rivaux.
// Si la personne n'était pas connectée, le code a été gardé et ce même écran revient après la connexion.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator } from 'react-native';
import { SpeedLinesBackground } from '../../src/components/comic';
import { t } from '../../src/i18n';
import { Alert } from '../../src/lib/alert';
import { api } from '../../src/lib/api';
import { extractInviteCode } from '../../src/lib/links';
import { setPendingInvite, usePrefs } from '../../src/lib/prefs';
import { useSession } from '../../src/lib/session';
import { colors } from '../../src/theme';

export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { session, profile } = useSession();
  const { loaded, rulesSeen } = usePrefs();
  const started = useRef(false);

  useEffect(() => {
    if (!code || !session || !profile || !loaded || started.current) return;
    started.current = true;
    const R = t().rivals;
    api.acceptInvite(extractInviteCode(String(code)))
      .then((res) => {
        Alert.alert(res.group_id ? R.joinedGroup : R.joinedDuo, res.group_name ?? undefined);
      })
      .catch((e: Error) => Alert.alert(t().errors.generic, e.message))
      .finally(() => {
        setPendingInvite(null);
        router.replace(rulesSeen ? '/rivaux' : '/regles');
      });
  }, [code, session, profile, loaded, rulesSeen, router]);

  return <SpeedLinesBackground><ActivityIndicator style={{ flex: 1 }} color={colors.ink} /></SpeedLinesBackground>;
}
