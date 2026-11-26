// Barre du bas BD : noire, ombre rouge, onglet actif jaune.
// La barre est dans le flux de la page (pas en position absolue) : aucun écran ne peut
// passer par-dessus et bloquer les clics, sur le web comme sur mobile.
import { Tabs, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../../src/i18n';
import { colors, fonts } from '../../src/theme';

const HREFS = { index: '/', rivaux: '/rivaux', tableau: '/tableau', profil: '/profil' } as const;

// Props de la barre fournies par expo-router (SDK 58) : state, navigateToTab, insets…
// (il n'y a plus d'objet « navigation » : l'ancien code plantait à chaque appui).
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function ComicTabBar({ state, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const labels: Record<string, string> = {
    index: t().tabs.play, rivaux: t().tabs.rivals, tableau: t().tabs.board, profil: t().tabs.profile,
  };
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const onPress = () => {
            if (focused) return;
            if (typeof navigateToTab === 'function') navigateToTab(route.key);
            else {
              const href = HREFS[route.name as keyof typeof HREFS];
              if (href) router.navigate(href);
            }
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={labels[route.name] ?? route.name}
              onPress={onPress}
              hitSlop={6}
              style={({ pressed }) => [styles.tab, focused && styles.tabOn, pressed && !focused && styles.tabPressed]}
            >
              <Text style={[styles.label, { color: focused ? colors.ink : colors.white }]}>{labels[route.name] ?? route.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.yellow } }}
      tabBar={(props) => <ComicTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="rivaux" />
      <Tabs.Screen name="tableau" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.yellow, paddingHorizontal: 16, paddingTop: 6, zIndex: 10 },
  bar: {
    height: 66, flexDirection: 'row', gap: 4, padding: 6,
    backgroundColor: colors.ink, borderRadius: 22,
    shadowColor: colors.red, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  tabOn: { backgroundColor: colors.yellow, borderWidth: 2, borderColor: colors.white },
  tabPressed: { backgroundColor: '#333333' },
  label: { fontFamily: fonts.comic, fontSize: 17, letterSpacing: 1 },
});
