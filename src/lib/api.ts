// Appels au serveur. Toute la logique de jeu (points, mines, cartes) vit
// dans les fonctions SQL : l'app n'envoie que des choix, jamais des scores.
import { supabase } from './supabase';

export type MyMatch = {
  match_id: string;
  kind: 'duo' | 'group' | 'card';
  status: 'open' | 'closed';
  opens_at: string;
  closes_at: string;
  theme_name: string;
  opponents: string | null;
  connection_id: string | null;
  group_id: string | null;
  card_multiplier: number;
  i_finished: boolean;
  players_total: number;
  players_finished: number;
  my_points: number | null;
  my_rank: number | null;
};

export type MatchQuestions = {
  match_id: string;
  status: 'open' | 'closed';
  closes_at: string;
  card_multiplier: number;
  theme: string;
  questions: { index: number; prompt: string; choices: string[] }[];
  answered: number[];
  my_mine: number | null;
};

export type Reveal = {
  match_id: string;
  winner: string | null;
  card_multiplier: number;
  questions: { index: number; prompt: string; choices: string[]; correct_index: number; mines: number; explanation?: string | null }[];
  players: {
    user_id: string; pseudo: string; points: number; rank: number; forfeit: boolean; mine: number | null;
    answers: { index: number; choice: number | null; sure: boolean; correct: boolean; points: number }[] | null;
  }[];
};

export type TitleRow = {
  scope: 'duo' | 'group' | 'global';
  scope_id: string | null;
  title_key: string;
  period: string;
  holder: string;
  value: number;
  profiles: { pseudo: string } | null;
};

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const api = {
  myMatches: () => rpc<MyMatch[]>('get_my_matches'),
  matchQuestions: (matchId: string) => rpc<MatchQuestions>('get_match_questions', { p_match: matchId }),
  submitAnswer: (matchId: string, index: number, choice: number | null, sure: boolean, ms: number) =>
    rpc<void>('submit_answer', { p_match: matchId, p_index: index, p_choice: choice, p_sure: sure, p_ms: ms }),
  placeMine: (matchId: string, index: number) => rpc<void>('place_mine', { p_match: matchId, p_index: index }),
  removeMine: (matchId: string) => rpc<void>('remove_mine', { p_match: matchId }),
  finish: (matchId: string) => rpc<boolean>('finish_my_match', { p_match: matchId }),
  useJoker: (matchId: string) => rpc<void>('use_joker', { p_match: matchId }),
  reveal: (matchId: string) => rpc<Reveal>('get_reveal', { p_match: matchId }),
  createInvite: (groupId?: string) => rpc<string>('create_invite', { p_group: groupId ?? null }),
  acceptInvite: (code: string) => rpc<{ connection_id?: string; group_id?: string; group_name?: string }>('accept_invite', { p_code: code }),
  createGroup: (name: string) => rpc<string>('create_group', { p_name: name }),
  addToGroup: (groupId: string, userId: string) => rpc<string>('add_to_group', { p_group: groupId, p_user: userId }),
  setRhythm: (days: number, connectionId?: string, groupId?: string) =>
    rpc<void>('set_rhythm', { p_days: days, p_connection: connectionId ?? null, p_group: groupId ?? null }),
  playCard: (cardId: string, theme: string, connectionId?: string, groupId?: string) =>
    rpc<string>('play_card', { p_card: cardId, p_theme: theme, p_connection: connectionId ?? null, p_group: groupId ?? null }),
  globalRank: () => rpc<{ rank: number | null; pct: number | null; total: number }>('my_global_rank'),

  notifyPlayers: (matchId: string) =>
    supabase.functions.invoke('notify-players', { body: { match_id: matchId } }),
  deleteAccount: () => supabase.functions.invoke('delete-account', { method: 'POST' }),

  titles: async (scope: 'duo' | 'group' | 'global', scopeId?: string) => {
    let q = supabase.from('title_holders').select('*, profiles(pseudo)').eq('scope', scope);
    q = scopeId ? q.eq('scope_id', scopeId) : q.is('scope_id', null);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as TitleRow[];
  },

  /** Score exact de la saison entre les joueurs d'un duo ou d'un groupe. */
  seasonScores: async (filter: { connectionId?: string; groupId?: string }) => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    let q = supabase
      .from('match_players')
      .select('user_id, points, profiles(pseudo), matches!inner(connection_id, group_id, status, closes_at, winner)')
      .eq('matches.status', 'closed')
      .gte('matches.closes_at', yearStart);
    q = filter.connectionId ? q.eq('matches.connection_id', filter.connectionId) : q.eq('matches.group_id', filter.groupId!);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const totals = new Map<string, { pseudo: string; points: number; wins: number }>();
    for (const row of (data ?? []) as unknown as {
      user_id: string; points: number | null; profiles: { pseudo: string } | null; matches: { winner: string | null };
    }[]) {
      const cur = totals.get(row.user_id) ?? { pseudo: row.profiles?.pseudo ?? '?', points: 0, wins: 0 };
      cur.points += row.points ?? 0;
      if (row.matches.winner === row.user_id) cur.wins += 1;
      totals.set(row.user_id, cur);
    }
    return [...totals.entries()]
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.points - a.points);
  },
};
