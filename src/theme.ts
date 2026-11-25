// Identité visuelle v3 « BD explosive » (voir les maquettes).
export const colors = {
  yellow: '#FFE014',
  yellowLight: '#FFF36B',
  yellowDeep: '#FFC400',
  starYellow: '#FFE600',
  red: '#E3170A',
  redLight: '#FF3B2B',
  ink: '#141414',
  white: '#FFFFFF',
  blue: '#1565C0',
  sky: '#7FD8FF',
  skyDeep: '#2EA8E6',
  pink: '#E8508A',
  pinkLight: '#F37BAA',
  paleYellow: '#F6E96B',
  green: '#1B8A4A',
  grey: '#6B6B6B',
} as const;

export const fonts = {
  comic: 'Bangers_400Regular',
  boom: 'LuckiestGuy_400Regular',
  body: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  bodyHeavy: 'DMSans_800ExtraBold',
} as const;

/** Ombre « case de BD » : décalée et pleine. */
export const comicShadow = (offset = 4) => ({
  shadowColor: colors.ink,
  shadowOffset: { width: offset, height: offset },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: offset,
});

/** Lettrage BD : texte avec contour (l'ombre portée tient lieu de contour sur mobile). */
export const outlinedText = (color: string, shadow: string = colors.ink, size = 3) => ({
  color,
  textShadowColor: shadow,
  textShadowOffset: { width: size, height: size },
  textShadowRadius: 0,
});

// Formes d'explosion (points en % de la boîte), reprises des maquettes.
export const BURST_A = [
  [50, 0], [59, 22], [78, 6], [74, 30], [100, 24], [82, 44], [98, 58], [78, 64], [90, 88], [66, 76],
  [58, 100], [47, 80], [26, 96], [30, 72], [4, 80], [20, 58], [0, 42], [22, 36], [10, 12], [36, 22],
] as const;
export const BURST_B = [
  [50, 2], [62, 24], [86, 10], [80, 36], [100, 46], [80, 58], [94, 84], [66, 76], [54, 100], [42, 78],
  [16, 92], [22, 64], [0, 52], [20, 40], [8, 14], [36, 26],
] as const;
export const STAR = [
  [50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35],
] as const;
