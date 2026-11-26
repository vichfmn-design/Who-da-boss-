// Version web du partage : feuille de partage du navigateur (Safari sur iPhone :
// Messages, WhatsApp…), sinon le texte est copié et affiché pour être collé à la main.
import { t } from '../i18n';
import { Alert } from './alert';

type WebNavigator = {
  share?: (data: { text: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export async function shareText(message: string): Promise<void> {
  const nav = (globalThis as { navigator?: WebNavigator }).navigator;
  if (nav?.share) {
    try {
      await nav.share({ text: message });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // partage annulé
    }
  }
  let copied = false;
  try { await nav?.clipboard?.writeText(message); copied = !!nav?.clipboard; } catch { copied = false; }
  Alert.alert(t().rivals.linkReady, copied ? `${t().rivals.linkCopied}\n\n${message}` : message);
}
