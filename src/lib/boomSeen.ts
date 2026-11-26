// Mines déjà « vues » (écran BOOM ! affiché) pour une partie : on ne remontre pas la même explosion.
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (matchId: string) => `wdb.boomSeen2.${matchId}`;

export async function getBoomSeen(matchId: string): Promise<number[]> {
  try { return JSON.parse((await AsyncStorage.getItem(key(matchId))) ?? '[]') as number[]; } catch { return []; }
}

export async function addBoomSeen(matchId: string, indexes: number[]): Promise<void> {
  const seen = new Set([...(await getBoomSeen(matchId)), ...indexes]);
  await AsyncStorage.setItem(key(matchId), JSON.stringify([...seen])).catch(() => {});
}
