// Les règles du jeu, en 7 cases de BD : au premier lancement, puis depuis le profil.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Burst, ComicButton, Panel, SpeedLinesBackground, Star } from '../src/components/comic';
import { t } from '../src/i18n';
import { markRulesSeen } from '../src/lib/prefs';
import { BURST_B, colors, comicShadow, fonts } from '../src/theme';

const BURST_COLORS = [colors.red, colors.blue, colors.green, colors.red, colors.ink, colors.pink, colors.skyDeep];

export default function Rules() {
  const R = t().rules;
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [page, setPage] = useState(0);
  const p = R.pages[page];
  const last = page === R.pages.length - 1;

  async function close() {
    await markRulesSeen();
    if (from === 'profil' && router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <SpeedLinesBackground cy={22}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap}>
          <View style={styles.top}>
            <Text style={styles.counter}>{`${page + 1} / ${R.pages.length}`}</Text>
            {!last && (
              <Pressable onPress={close} accessibilityRole="button" style={[styles.pill, comicShadow(3)]}>
                <Text style={styles.pillText}>{R.skip}</Text>
              </Pressable>
            )}
          </View>

          <Burst width={250} height={190} fill={BURST_COLORS[page % BURST_COLORS.length]} shape={BURST_B} rotate={-5}
            style={{ alignSelf: 'center' }}>
            <Text style={styles.burstText}>{p.burst}</Text>
          </Burst>

          <Panel tilt={page % 2 === 0 ? -1 : 1} style={{ gap: 12 }}>
            <Text style={styles.title}>{p.title}</Text>
            {p.lines.map((line) => (
              <View key={line} style={styles.line}>
                <View style={{ marginTop: 2 }}><Star size={16} fill={colors.red} /></View>
                <Text style={styles.text}>{line}</Text>
              </View>
            ))}
          </Panel>

          <View style={styles.dots} accessibilityElementsHidden>
            {R.pages.map((_, i) => (
              <Pressable key={i} onPress={() => setPage(i)} hitSlop={6}
                style={[styles.dot, i === page && styles.dotOn]} />
            ))}
          </View>

          <View style={styles.nav}>
            {page > 0 && (
              <ComicButton label={R.prev} color={colors.white} textColor={colors.ink} size={20}
                onPress={() => setPage(page - 1)} style={{ flex: 1 }} />
            )}
            <ComicButton label={last ? R.done : R.next} size={last ? 20 : 24}
              onPress={() => (last ? close() : setPage(page + 1))} style={{ flex: 2 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </SpeedLinesBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 18, flexGrow: 1, justifyContent: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontFamily: fonts.comic, fontSize: 20, letterSpacing: 1, color: colors.ink },
  pill: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3 },
  pillText: { fontFamily: fonts.comic, fontSize: 16, letterSpacing: 1 },
  burstText: { fontFamily: fonts.comic, fontSize: 46, color: colors.yellow, textAlign: 'center',
    textShadowColor: colors.ink, textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0 },
  title: { fontFamily: fonts.comic, fontSize: 28, letterSpacing: 1, color: colors.ink },
  line: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  text: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.ink },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white },
  dotOn: { backgroundColor: colors.red, transform: [{ scale: 1.25 }] },
  nav: { flexDirection: 'row', gap: 12 },
});
