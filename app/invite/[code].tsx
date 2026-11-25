// Lien d'invitation whodaboss://invite/CODE : accepte et renvoie vers Rivaux.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { SpeedLinesBackground } from '../../src/components/comic';
import { t } from '../../src/i18n';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  useEffect(() => {
    api.acceptInvite(code)
      .then(() => router.replace('/rivaux'))
      .catch((e: Error) => { Alert.alert(t().errors.generic, e.message); router.replace('/'); });
  }, [code, router]);
  return <SpeedLinesBackground><ActivityIndicator style={{ flex: 1 }} color={colors.ink} /></SpeedLinesBackground>;
}
