// Liens d'invitation : toujours une adresse web cliquable (dans Messages, WhatsApp…),
// qui ouvre l'app web, ou l'app iPhone quand elle sera installée.
import { Platform } from 'react-native';

const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://who-da-boss-fl8n.onrender.com';

export function inviteUrl(code: string): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : SITE;
  return `${origin}/invite/${code}`;
}

/** Accepte un code (« a1b2c3d4 ») ou un lien complet collé tel quel. */
export function extractInviteCode(input: string): string {
  const m = input.match(/invite\/([A-Za-z0-9]+)/);
  return (m ? m[1] : input).trim().toLowerCase();
}
