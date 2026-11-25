// Barre du bas BD : noire, ombre rouge, onglet actif jaune.
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../../src/i18n';
import { colors, fonts } from '../../src/theme';

function ComicTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const labels: Record<string, string> = {
    index: t().tabs.play, rivaux: t().tabs.rivals, tableau: t().tabs.board, profil: t().tabs.profile,
  };
  return (
    <View style={[styles.bar, { marginBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => { if (!focused) navigation.navigate(route.name); }}
            style={[styles.tab, focused && styles.tabOn]}
          >
            <Text style={[styles.label, { color: focused ? colors.ink : colors.white }]}>{labels[route.name] ?? route.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <ComicTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="rivaux" />
      <Tabs.Screen name="tableau" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 16, right: 16, bottom: 0, height: 66, flexDirection: 'row', gap: 4, padding: 6,
    backgroundColor: colors.ink, borderRadius: 22,
    shadowColor: colors.red, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  tabOn: { backgroundColor: colors.yellow, borderWidth: 2, borderColor: colors.white },
  label: { fontFamily: fonts.comic, fontSize: 17, letterSpacing: 1 },
});
