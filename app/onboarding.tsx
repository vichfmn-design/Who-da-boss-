// Premier lancement : pseudo + thèmes préférés (3 minimum).
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ComicButton, ComicTitle, SpeedLinesBackground } from '../src/components/comic';
import { getLang, t } from '../src/i18n';
import { useSession } from '../src/lib/session';
import { supabase } from '../src/lib/supabase';
import { colors, comicShadow, fonts } from '../src/theme';

type Theme = { slug: string; name_fr: string; name_en: string };

export default function Onboarding() {
  const O = t().onboarding;
  const { session, refreshProfile } = useSession();
  const [pseudo, setPseudo] = useState('');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('themes').select('slug, name_fr, name_en').eq('active', true).order('sort')
      .then(({ data }) => setThemes((data as Theme[]) ?? []));
  }, []);

  const toggle = (slug: string) =>
    setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));

  async function save() {
    if (!session) return;
    setBusy(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
    const { error } = await supabase.from('profiles').insert({ id: session.user.id, pseudo: pseudo.trim(), lang: getLang(), timezone: tz });
    if (error) { setBusy(false); return Alert.alert(t().errors.generic, error.message); }
    await supabase.from('user_themes').insert(picked.map((slug) => ({ user_id: session.user.id, theme_slug: slug })));
    await refreshProfile();
    setBusy(false);
  }

  const lang = getLang();
  return (
    <SpeedLinesBackground cy={10}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap}>
          <ComicTitle size={44}>{O.title}</ComicTitle>
          <TextInput
            style={styles.input} placeholder={O.pseudo} value={pseudo} onChangeText={setPseudo}
            maxLength={20} autoCapitalize="none" accessibilityLabel={O.pseudo}
          />
          <Text style={styles.label}>{O.themes}</Text>
          <View style={styles.grid}>
            {themes.map((th) => {
              const on = picked.includes(th.slug);
              return (
                <Pressable
                  key={th.slug} onPress={() => toggle(th.slug)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  style={[styles.chip, comicShadow(on ? 5 : 3), on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && { color: colors.yellow }]}>
                    {lang === 'en' ? th.name_en : th.name_fr}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <ComicButton label={O.go} disabled={busy || pseudo.trim().length < 2 || picked.length < 3} onPress={save} />
        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 18 },
  input: { borderWidth: 3, borderColor: colors.ink, borderRadius: 12, paddingHorizontal: 14, height: 54,
    fontFamily: fonts.bodyBold, fontSize: 18, backgroundColor: colors.white },
  label: { fontFamily: fonts.comic, fontSize: 22, letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 3, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.red, transform: [{ rotate: '-2deg' }] },
  chipText: { fontFamily: fonts.comic, fontSize: 18, letterSpacing: 1, color: colors.ink },
});
