// Briques visuelles BD : explosion, étoile, bombe, bulle, panneau, bouton, fond à lignes de vitesse.
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { BURST_A, STAR, colors, comicShadow, fonts } from '../theme';

type Shape = readonly (readonly [number, number])[];
const toPoints = (shape: Shape) => shape.map(([x, y]) => `${x},${y}`).join(' ');

/** Explosion BD : ombre noire décalée, contour noir épais, remplissage coloré, contenu centré. */
export function Burst({
  width, height, fill, shape = BURST_A, shadow = 6, outline = 3, children, style, rotate = 0, stroke = colors.ink, glow,
}: {
  width: number; height: number; fill: string; shape?: Shape; shadow?: number; outline?: number;
  children?: React.ReactNode; style?: StyleProp<ViewStyle>; rotate?: number;
  /** Couleur du contour (noir par défaut). */
  stroke?: string;
  /** Halo clair au centre (dégradé radial vers la couleur de remplissage). */
  glow?: string;
}) {
  const gradId = React.useId().replace(/:/g, '');
  const pts = toPoints(shape);
  // Marge autour de la forme : l'ombre décalée et le contour épais ne coupent plus les pointes.
  const sx = (shadow / width) * 100;
  const sy = (shadow / height) * 100;
  const m = 6;
  const viewBox = `${-m} ${-m} ${100 + 2 * m + sx} ${100 + 2 * m + sy}`;
  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height} viewBox={viewBox} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Polygon points={pts} fill={colors.ink} transform={`translate(${(shadow / width) * 100} ${(shadow / height) * 100})`} />
        {glow && (
          <Defs>
            <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={glow} />
              <Stop offset="1" stopColor={fill} />
            </RadialGradient>
          </Defs>
        )}
        <Polygon points={pts} fill={glow ? `url(#${gradId})` : fill} stroke={stroke} strokeWidth={(outline / Math.min(width, height)) * 100 * 2} strokeLinejoin="miter" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center, { transform: [{ rotate: `${rotate}deg` }] }]}>{children}</View>
    </View>
  );
}

export function Star({ size = 24, fill = colors.starYellow }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points={toPoints(STAR)} fill={fill} stroke={colors.ink} strokeWidth={8} strokeLinejoin="round" />
    </Svg>
  );
}

export function Bomb({ size = 34, spark = colors.starYellow }: { size?: number; spark?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx={18} cy={23} r={13} fill={colors.ink} />
      <Circle cx={13} cy={18} r={3.5} fill={colors.white} opacity={0.85} />
      <Rect x={21} y={7} width={8} height={7} rx={1.5} fill={colors.ink} transform="rotate(40 25 10.5)" />
      <Path d="M28 8 Q32 3 35 5" stroke={colors.ink} strokeWidth={2.2} fill="none" />
      <Path d="M36 0 L37 3.5 L40 4 L37.5 6 L38.5 9.5 L36 7.5 L33.5 9.5 L34.3 6 L32 4 L35 3.5 Z" fill={spark} stroke={colors.ink} strokeWidth={1} />
    </Svg>
  );
}

/** Fond jaune avec lignes de vitesse qui partent du centre de l'action. */
export function SpeedLinesBackground({ cx = 50, cy = 45, children, style }: {
  cx?: number; cy?: number; children?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const rays = Array.from({ length: 36 }, (_, i) => {
    const a1 = (i * 10 * Math.PI) / 180;
    const a2 = ((i * 10 + 3) * Math.PI) / 180;
    const r = 200;
    return `M${cx} ${cy} L${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} L${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)} Z`;
  });
  return (
    <View style={[{ flex: 1, backgroundColor: colors.yellow }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={raysStyle}>
        {rays.map((d, i) => <Path key={i} d={d} fill={colors.white} opacity={0.3} />)}
      </Svg>
      {children}
    </View>
  );
}

// Les rayons couvrent tout l'écran : sur le web, toute la fenêtre (même si l'app garde
// une largeur de téléphone au centre), sur mobile, tout l'écran de la page.
const raysStyle = (Platform.OS === 'web'
  ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }
  : StyleSheet.absoluteFill) as unknown as StyleProp<ViewStyle>;

/** Faisceaux rouges presque transparents au fond des cartes blanches : un seul éventail par carte,
 *  partant d'un coin ou d'un bord (au hasard, donc le sens change d'une carte à l'autre). */
const BEAM_ORIGINS: [number, number, number, number][] = [
  // x, y, angle de début, angle de fin (degrés)
  [105, -8, 100, 175], [-5, -8, 5, 80], [-5, 108, -80, -5], [105, 108, 185, 260], [50, -15, 25, 155],
];
export function CardBeams({ dir }: { dir?: number }) {
  const [cx, cy, from, to] = React.useMemo(
    () => BEAM_ORIGINS[(dir ?? Math.floor(Math.random() * BEAM_ORIGINS.length)) % BEAM_ORIGINS.length], [dir]);
  const n = 8;
  const w = (2.4 * Math.PI) / 180;
  const r = 260;
  const paths = Array.from({ length: n }, (_, i) => {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
    return `M${cx} ${cy} L${cx + r * Math.cos(a - w)} ${cy + r * Math.sin(a - w)} L${cx + r * Math.cos(a + w)} ${cy + r * Math.sin(a + w)} Z`;
  });
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
      {paths.map((d, i) => <Path key={i} d={d} fill={colors.red} opacity={0.06} />)}
    </Svg>
  );
}

/** Bulle de dialogue avec petite queue (en bas, à gauche ou en haut). */
export function SpeechBubble({
  children, color = colors.white, tail = 'bottom', style,
}: {
  children: React.ReactNode; color?: string; tail?: 'bottom' | 'left' | 'top'; style?: StyleProp<ViewStyle>;
}) {
  const tailStyle: ViewStyle =
    tail === 'left'
      ? { left: -9, top: '50%', marginTop: -8, borderLeftWidth: 3, borderBottomWidth: 3 }
      : tail === 'top'
        ? { top: -9, left: 30, borderLeftWidth: 3, borderTopWidth: 3 }
        : { bottom: -9, left: 26, borderRightWidth: 3, borderBottomWidth: 3 };
  return (
    <View style={[styles.bubble, { backgroundColor: color }, comicShadow(4), style]}>
      <View style={[styles.tail, { backgroundColor: color }, tailStyle]} />
      {children}
    </View>
  );
}

/** Case de BD : cadre noir épais, ombre décalée. */
export function Panel({ children, style, tilt = 0 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tilt?: number }) {
  return (
    <View style={[styles.panel, comicShadow(6), { transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: 3, overflow: 'hidden' }]} pointerEvents="none"><CardBeams /></View>
      {children}
    </View>
  );
}

export function ComicButton({
  label, onPress, color = colors.red, textColor = colors.yellow, disabled, style, size = 30,
}: {
  label: string; onPress: () => void; color?: string; textColor?: string; disabled?: boolean;
  style?: StyleProp<ViewStyle>; size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button, comicShadow(pressed ? 2 : 6),
        { backgroundColor: disabled ? '#EDEDED' : color, transform: [{ translateY: pressed ? 3 : 0 }, { rotate: '-1deg' }] },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { fontSize: size, color: disabled ? colors.grey : textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function ComicTitle({ children, size = 32 }: { children: React.ReactNode; size?: number }) {
  return (
    <Text style={{ fontFamily: fonts.comic, fontSize: size, letterSpacing: 1, color: colors.white,
      textShadowColor: colors.red, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 }}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  bubble: { borderWidth: 3, borderColor: colors.ink, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8 },
  tail: { position: 'absolute', width: 16, height: 16, borderColor: colors.ink, transform: [{ rotate: '45deg' }] },
  panel: { backgroundColor: colors.white, borderWidth: 4, borderColor: colors.ink, borderRadius: 6, padding: 16 },
  button: { borderWidth: 4, borderColor: colors.ink, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontFamily: fonts.comic, letterSpacing: 2 },
});
