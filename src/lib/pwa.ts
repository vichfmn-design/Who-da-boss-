// iPhone : une app ajoutée à l'écran d'accueil ne peut pas « attraper » les liens, ils s'ouvrent dans Safari.
// On propose donc de copier le lien d'invitation dans Safari, puis de le coller dans l'app.
import { Platform } from 'react-native';

type Nav = { userAgent?: string; standalone?: boolean; clipboard?: { writeText?: (s: string) => Promise<void>; readText?: () => Promise<string> } };
const nav = () => (globalThis as { navigator?: Nav }).navigator;

/** Safari (ou autre navigateur) sur iPhone / iPad, hors de l'app de l'écran d'accueil. */
export function isIosBrowser(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const ua = nav()?.userAgent ?? '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in window);
  const standalone = nav()?.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  return ios && !standalone;
}

export async function copyText(text: string): Promise<boolean> {
  try { await nav()?.clipboard?.writeText?.(text); return !!nav()?.clipboard?.writeText; } catch { return false; }
}

export async function pasteText(): Promise<string | null> {
  try { return (await nav()?.clipboard?.readText?.()) ?? null; } catch { return null; }
}
