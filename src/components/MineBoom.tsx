// Écran « BOOM ! Une mine vient d'exploser ! » avec les selfies de ceux qui ont posé la mine.
// Affiché à la révélation des résultats (quand tout le monde a joué), pas pendant la partie.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { t } from '../i18n';
import { useSelfieUrl } from '../lib/selfieUrl';
import { colors, comicShadow, fonts } from '../theme';
import { Bomb, Burst, Panel, SpeedLinesBackground } from './comic';

export type Miner = { pseudo: string; selfie: string | null };

/** Le selfie de celui qui a posé la mine, sous le BOOM (bombe si pas de selfie). */
function MinerSelfie({ pseudo, path }: Miner & { path: string | null }) {
  const url = useSelfieUrl(path);
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={[styles.selfie, comicShadow(5)]}>
        {url ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} accessibilityLabel={pseudo} /> : <Bomb size={64} />}
      </View>
      <View style={styles.trap}>
        <Text style={styles.trapText}>{t().duel.trapBy(pseudo)}</Text>
      </View>
    </View>
  );
}

/** Petit nuage BD (blanc, contour noir) autour de l'explosion. */
function Cloud({ style }: { style?: object }) {
  const bumps = [[30, 52, 24], [62, 36, 30], [96, 50, 24], [64, 60, 22]] as const;
  return (
    <View style={style} pointerEvents="none">
      <Svg width={130} height={86} viewBox="0 0 130 86">
        {bumps.map(([cx, cy, r], i) => <Circle key={`o${i}`} cx={cx} cy={cy} r={r + 3.5} fill={colors.ink} />)}
        {bumps.map(([cx, cy, r], i) => <Circle key={`i${i}`} cx={cx} cy={cy} r={r} fill={colors.white} />)}
      </Svg>
    </View>
  );
}

export function MineBoom({ question, miners, onDone }: { question: number; miners: Miner[]; onDone: () => void }) {
  const D = t().duel;
  return (
    <Pressable style={{ flex: 1 }} onPress={onDone} accessibilityRole="button" accessibilityLabel={D.mineBoomSub}>
      <SpeedLinesBackground>
        <SafeAreaView style={styles.wrap}>
          <View style={{ width: 340, height: 330, alignItems: 'center', justifyContent: 'center' }}>
            <Burst width={330} height={320} fill={colors.red} glow={colors.redLight} shadow={9} outline={4}>
              <Text style={styles.boomText}>{D.mineBoom}</Text>
              <View style={[styles.boomLabel, comicShadow(4)]}>
                <Text style={styles.boomLabelText}>{D.mineBoomSub}</Text>
              </View>
            </Burst>
            <Cloud style={{ position: 'absolute', top: -6, left: -14 }} />
            <Cloud style={{ position: 'absolute', top: 0, right: -14 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: -24 }}>
            {miners.map((m) => <MinerSelfie key={m.pseudo} pseudo={m.pseudo} selfie={m.selfie} path={m.selfie} />)}
          </View>
          <Panel tilt={1}>
            <Text style={styles.rule}>{D.mineBoomWhere(question + 1)} {D.mineBoomLoss(miners.length)}</Text>
          </Panel>
          <Text style={styles.rule}>{D.tapToContinue}</Text>
        </SafeAreaView>
      </SpeedLinesBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 14, justifyContent: 'center', alignItems: 'center' },
  selfie: { width: 120, height: 120, borderRadius: 60, borderWidth: 5, borderColor: colors.ink, backgroundColor: colors.white,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  trap: { backgroundColor: colors.ink, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999 },
  trapText: { fontFamily: fonts.comic, fontSize: 18, letterSpacing: 0.5, color: colors.yellow },
  rule: { fontFamily: fonts.bodyBold, fontSize: 13, textAlign: 'center' },
  boomText: { fontFamily: fonts.boom, fontSize: 76, color: colors.yellow, transform: [{ rotate: '-6deg' }],
    textShadowColor: colors.ink, textShadowOffset: { width: 4, height: 5 }, textShadowRadius: 0 },
  boomLabel: { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 4,
    transform: [{ rotate: '-4deg' }], marginTop: 6 },
  boomLabelText: { fontFamily: fonts.comic, fontSize: 18, letterSpacing: 0.5, color: colors.red },
});
