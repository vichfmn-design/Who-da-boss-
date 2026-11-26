// Boîtes de dialogue sur iPhone et Android : celles du système.
// Sur le web, c'est alert.tsx (React Native Web n'affiche pas Alert.alert). Ne pas renommer en .ts :
// Metro choisirait alert.ts avant alert.web.tsx et les fenêtres ne s'afficheraient plus sur le web.
import { Alert } from 'react-native';

export { Alert };

/** Rien à afficher sur mobile : le système gère les fenêtres. */
export function DialogHost() {
  return null;
}
