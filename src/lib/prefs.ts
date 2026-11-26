// Petites préférences gardées sur l'appareil :
// - règles du jeu déjà vues (l'écran des règles s'affiche une seule fois au début) ;
// - invitation en attente (lien ouvert avant d'être connecté : on l'accepte après la connexion).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const RULES_KEY = 'wdb.rulesSeen.v1';
const INVITE_KEY = 'wdb.pendingInvite';

let rulesSeen: boolean | null = null;
let pendingInvite: string | null | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

Promise.all([AsyncStorage.getItem(RULES_KEY), AsyncStorage.getItem(INVITE_KEY)])
  .then(([r, i]) => { rulesSeen = r === '1'; pendingInvite = i; emit(); })
  .catch(() => { rulesSeen = false; pendingInvite = null; emit(); });

export function usePrefs() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return {
    loaded: rulesSeen !== null && pendingInvite !== undefined,
    rulesSeen: !!rulesSeen,
    pendingInvite: pendingInvite ?? null,
  };
}

export async function markRulesSeen(): Promise<void> {
  rulesSeen = true;
  emit();
  await AsyncStorage.setItem(RULES_KEY, '1').catch(() => {});
}

export async function setPendingInvite(code: string | null): Promise<void> {
  if (code === pendingInvite) return;
  pendingInvite = code;
  emit();
  if (code) await AsyncStorage.setItem(INVITE_KEY, code).catch(() => {});
  else await AsyncStorage.removeItem(INVITE_KEY).catch(() => {});
}
