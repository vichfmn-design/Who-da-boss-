// Version web des boîtes de dialogue : React Native Web ignore Alert.alert,
// on affiche donc une fenêtre maison dans le style BD (même API que Alert.alert).
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import type { AlertButton } from 'react-native';
import { colors, comicShadow, fonts } from '../theme';

type Dialog = { title: string; message?: string; buttons: AlertButton[] };

let current: Dialog | null = null;
const listeners = new Set<(d: Dialog | null) => void>();
function setDialog(d: Dialog | null) {
  current = d;
  listeners.forEach((l) => l(d));
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    setDialog({ title, message, buttons: buttons && buttons.length ? buttons : [{ text: 'OK' }] });
  },
};

export function DialogHost() {
  const [dialog, setLocal] = useState<Dialog | null>(current);
  useEffect(() => {
    listeners.add(setLocal);
    return () => { listeners.delete(setLocal); };
  }, []);
  if (!dialog) return null;

  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  const choose = (b?: AlertButton) => {
    setDialog(null);
    b?.onPress?.();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => choose(cancel)}>
      <Pressable style={styles.backdrop} onPress={() => choose(cancel)}>
        <Pressable style={[styles.box, comicShadow(6)]} onPress={() => {}}>
          <Text style={styles.title}>{dialog.title}</Text>
          {!!dialog.message && <Text style={styles.message}>{dialog.message}</Text>}
          {dialog.buttons.map((b, i) => (
            <Pressable
              key={`${b.text}-${i}`} onPress={() => choose(b)} accessibilityRole="button"
              style={[styles.button, b.style === 'cancel' && styles.cancel, b.style === 'destructive' && styles.destructive]}>
              <Text style={[styles.buttonText, b.style === 'destructive' && { color: colors.white }]}>{b.text}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,20,20,0.55)', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 16, padding: 18, gap: 10,
    width: '100%', maxWidth: 420, alignSelf: 'center' },
  title: { fontFamily: fonts.comic, fontSize: 26, letterSpacing: 1, color: colors.ink },
  message: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, marginBottom: 4 },
  button: { borderWidth: 3, borderColor: colors.ink, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    backgroundColor: colors.yellow },
  cancel: { backgroundColor: colors.white },
  destructive: { backgroundColor: colors.red },
  buttonText: { fontFamily: fonts.comic, fontSize: 20, letterSpacing: 1, color: colors.ink },
});
