// Boîtes de dialogue. Sur iPhone et Android : celles du système.
// Sur le web, c'est alert.web.tsx qui est utilisé (React Native Web n'affiche pas Alert.alert).
import { Alert } from 'react-native';

export { Alert };

/** Rien à afficher sur mobile : le système gère les fenêtres. */
export function DialogHost() {
  return null;
}
