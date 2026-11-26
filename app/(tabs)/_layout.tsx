// Barre du bas BD, version « verre liquide » comme Hellomoïra : barre noire translucide
// (floutée sur le web), bulle jaune qui glisse sous l'onglet choisi, rebondit, s'écrase
// comme une goutte d'eau, avec une onde et deux gouttelettes. Couleurs Who da Boss ?.
import { Tabs, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { t } from '../../src/i18n';
import { colors, fonts } from '../../src/theme';

const HREFS = { index: '/', rivaux: '/rivaux', tableau: '/tableau', profil: '/profil' } as const;

/** Pictogrammes du menu : jouer, rivaux, classement (coupe), profil. */
function TabIcon({ name, color }: { name: string; color: string }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {name === 'index' && <Polygon points="7,4 20,12 7,20" {...p} fill={colors.green} />}
      {name === 'rivaux' && (
        <>
          <Circle cx={9} cy={8} r={4} {...p} />
          <Path d="M2 21c0-4 3-7 7-7s7 3 7 7" {...p} />
          <Circle cx={17} cy={9} r={3} {...p} />
          <Path d="M17.5 14c2.8.3 4.5 2.8 4.5 6" {...p} />
        </>
      )}
      {name === 'tableau' && (
        <>
          <Path d="M7 3h10v5a5 5 0 0 1-10 0z" {...p} fill={colors.red} />
          <Path d="M7 5H4.5a3 3 0 0 0 3 4.5M17 5h2.5a3 3 0 0 1-3 4.5" {...p} />
          <Path d="M12 13v4M8.5 21h7M9.5 17h5v4h-5z" {...p} />
        </>
      )}
      {name === 'profil' && (
        <>
          <Circle cx={12} cy={8} r={4} {...p} />
          <Path d="M4 21c0-4.5 3.6-8 8-8s8 3.5 8 8" {...p} />
        </>
      )}
    </Svg>
  );
}
const PAD = 6;
const native = Platform.OS !== 'web';

// Props de la barre fournies par expo-router (SDK 58) : state, navigateToTab, insets…
// (il n'y a plus d'objet « navigation » : l'ancien code plantait à chaque appui).
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function ComicTabBar({ state, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const labels: Record<string, string> = {
    index: t().tabs.play, rivaux: t().tabs.rivals, tableau: t().tabs.board, profil: t().tabs.profile,
  };
  const count = state.routes.length;
  const [barWidth, setBarWidth] = useState(0);
  const tabWidth = barWidth > 0 ? (barWidth - PAD * 2) / count : 0;

  // Position de la bulle, écrasement, appui, onde et gouttelettes
  const x = useRef(new Animated.Value(0)).current;
  const sx = useRef(new Animated.Value(1)).current;
  const sy = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(1)).current;
  const ripple = useRef(new Animated.Value(1)).current;
  const drops = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (!tabWidth) return;
    const target = state.index * tabWidth;
    if (first.current) { x.setValue(target); first.current = false; return; }
    // Glissement avec léger dépassement (cubic-bezier(0.2, 1.1, 0.28, 1) chez Hellomoïra)
    Animated.spring(x, { toValue: target, useNativeDriver: native, speed: 14, bounciness: 7 }).start();
    // Écrasement « goutte d'eau »
    const step = (a: number, b: number, d: number) => Animated.parallel([
      Animated.timing(sx, { toValue: a, duration: d, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(sy, { toValue: b, duration: d, easing: Easing.out(Easing.quad), useNativeDriver: native }),
    ]);
    Animated.sequence([step(1.1, 0.92, 105), step(0.96, 1.05, 125), step(1.025, 0.98, 140), step(0.99, 1.015, 110), step(1, 1, 110)]).start();
    ripple.setValue(0);
    drops.setValue(0);
    Animated.timing(ripple, { toValue: 1, duration: 530, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
    Animated.timing(drops, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
  }, [state.index, tabWidth, x, sx, sy, ripple, drops]);

  const onLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);
  const pressTo = (v: number) =>
    Animated.timing(press, { toValue: v, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();

  const rippleScale = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.38] });
  const rippleOpacity = ripple.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.9, 0.6, 0] });
  const dropOpacity = drops.interpolate({ inputRange: [0, 0.12, 0.33, 1], outputRange: [0, 0, 0.8, 0] });
  const dropLeftX = drops.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const dropLeftY = drops.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const dropRightX = drops.interpolate({ inputRange: [0, 1], outputRange: [0, 12] });
  const dropRightY = drops.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) }]}>
      <View style={[styles.bar, glass]} onLayout={onLayout} accessibilityRole="tablist">
        {tabWidth > 0 && (
          <Animated.View pointerEvents="none"
            style={[styles.track, { width: tabWidth, transform: [{ translateX: x }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.ripple, { opacity: rippleOpacity, transform: [{ scale: rippleScale }] }]} />
            <Animated.View style={[styles.bubble, { transform: [{ scaleX: Animated.multiply(sx, press) }, { scaleY: Animated.multiply(sy, press) }] }]} />
            <Animated.View style={[styles.drop, { left: -3, top: '45%', opacity: dropOpacity, transform: [{ translateX: dropLeftX }, { translateY: dropLeftY }] }]} />
            <Animated.View style={[styles.drop, styles.dropSmall, { right: -3, top: '30%', opacity: dropOpacity, transform: [{ translateX: dropRightX }, { translateY: dropRightY }] }]} />
          </Animated.View>
        )}
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
              onPressIn={() => focused && pressTo(0.95)}
              onPressOut={() => pressTo(1)}
              hitSlop={6}
              style={styles.tab}
            >
              <TabIcon name={route.name} color={focused ? colors.ink : colors.white} />
              <Text style={[styles.label, { color: focused ? colors.ink : colors.white }]}>{labels[route.name] ?? route.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Verre : noir translucide, flou derrière (web)
const glass = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as unknown as object)
  : {};

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
  // Barre flottante au-dessus du contenu (le contenu défile dessous, visible à travers le verre)
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 10 },
  bar: {
    height: 72, flexDirection: 'row', padding: PAD,
    backgroundColor: 'rgba(20, 20, 20, 0.62)', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: colors.red, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.9, shadowRadius: 0, elevation: 6,
  },
  track: { position: 'absolute', top: PAD, bottom: PAD, left: PAD },
  bubble: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, backgroundColor: 'rgba(255, 224, 20, 0.92)',
    borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.85)', overflow: 'hidden',
  },
  ripple: { borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.95)' },
  drop: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: colors.yellow },
  dropSmall: { width: 5, height: 5, borderRadius: 3 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, borderRadius: 999, zIndex: 1 },
  // Marge à droite : la police BD penchée débordait et coupait la dernière lettre (le T de CLASSEMENT)
  label: { fontFamily: fonts.comic, fontSize: 13, letterSpacing: 0.3, paddingHorizontal: 4 },
});
