// Partage d'un texte (lien d'invitation). Sur mobile : la feuille de partage du système.
import { Share } from 'react-native';

export async function shareText(message: string): Promise<void> {
  await Share.share({ message });
}
