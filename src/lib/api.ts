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
  group_name: string | null;
};

export type MatchQuestions = {
  match_id: string;
  status: 'open' | 'closed';
  closes_at: string;
  card_multiplier: number;
  theme: string;
  questions: { index: number; prompt: string; choices: string[] }[];
  answered: number[];
  resumed?: boolean;
  my_mine: number | null;
};

export type Reveal = {
  match_id: string;
  winner: string | null;
  card_multiplier: number;
  my_booms?: { index: number; miners: { pseudo: string; selfie: string | null }[] | null }[];
  questions: { index: number; prompt: string; choices: string[]; correct_index: number; mines: number; explanation?: string | null }[];
  players: {
    user_id: string; pseudo: string; points: number; rank: number; forfeit: boolean; mine: number | null;
    answers: { index: number; choice: number | null; sure: boolean; correct: boolean; points: number }[] | null;
  }[];
};

export type RecapTheme = {
  slug: string; name: string; total: number; correct: number;
  questions: { prompt: string; correct: boolean; date: string; mine: string | null; answer: string | null; explanation: string | null }[];
};

export type MyAnswers = {
  match_id: string; status: 'open' | 'closed'; closes_at: string; theme: string;
  players_total: number; players_finished: number;
  answers: { index: number; prompt: string; choice: string | null; correct: boolean; sure: boolean; mine: boolean }[];
};

export type MyStats = {
  played: number; wins: number; losses: number; forfeits: number; season_points: number; best_game: number | null;
  answered: number; correct: number; sure_total: number; sure_correct: number;
  avg_ms_correct: number | null; fastest_ms: number | null;
  mines_placed: number; mines_triggered: number; mines_hit: number;
  boosts_played: number; boosts_won: number; bonus_earned: number; cards_won: number; best_streak: number;
  themes: { slug: string; name: string; answered: number; correct: number }[];
  boost_bests?: Partial<Record<BoostGame, { score: number; display: string | null }>>;
  boost_best_streak?: number; boost_runs?: number; boost_points?: number;
  favorite_rival: { pseudo: string; games: number } | null;
  nemesis: { pseudo: string; they_won: number } | null;
  victim: { pseudo: string; i_won: number } | null;
};

export type BoostGame = 'frappe' | 'rebus' | 'chiffre' | 'reflexe' | 'memoire' | 'chrono';
export type BoostContent = {
  text?: string;                                          // frappe
  items?: { emoji: string; choices: string[] }[];         // rebus
  q?: string; unit?: string;                              // chiffre
  delays?: number[];                                      // reflexe
  sequence?: number[];                                    // memoire
  target?: number;                                        // chrono
};
export type BoostChallenge = {
  id: string; game: BoostGame; status: 'open' | 'closed'; closes_at: string;
  connection_id: string | null; group_id: string | null; label: string | null;
  i_finished: boolean; winner: string | null; winner_points: number | null;
};
export type MyBoosts = {
  tokens: { connection_id: string | null; group_id: string | null; count: number; is_last: boolean }[];
  active_run: string | null;
  challenges: BoostChallenge[];
};
export type BoostRunState = {
  run_id?: string; ended?: boolean; correct?: boolean; streak: number; points: number; theme?: string;
  question?: { prompt: string; choices: string[] } | null; elapsed_ms?: number;
  correct_index?: number | null; explanation?: string | null;
};
export type BoostInfo = {
  id: string; game: BoostGame; status: 'open' | 'closed'; closes_at: string; launcher: string | null; label: string | null;
  winner: string | null; winner_is_me: boolean | null; winner_points: number | null; answer: number | null;
  me: { started: boolean; finished: boolean; display: string | null } | null;
  players: { pseudo: string; me: boolean; finished: boolean; display: string | null; points: number }[];
};

export type TitleRow = {
  scope: 'duo' | 'group' | 'global';
  scope_id: string | null;
  title_key: string;
  period: string;
  holder: string;
  value: number;
  display: string | null;
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
    rpc<{ mine_hit: boolean; mines: number; miners?: { pseudo: string; selfie: string | null }[] } | null>('submit_answer', { p_match: matchId, p_index: index, p_choice: choice, p_sure: sure, p_ms: ms }),
  placeMine: (matchId: string, index: number) => rpc<void>('place_mine', { p_match: matchId, p_index: index }),
  removeMine: (matchId: string) => rpc<void>('remove_mine', { p_match: matchId }),
  finish: (matchId: string) => rpc<boolean>('finish_my_match', { p_match: matchId }),
  reveal: (matchId: string) => rpc<Reveal>('get_reveal', { p_match: matchId }),
  questionRecap: () => rpc<RecapTheme[]>('my_question_recap'),
  myAnswers: (matchId: string) => rpc<MyAnswers>('get_my_answers', { p_match: matchId }),
  myBoosts: () => rpc<MyBoosts>('my_boosts'),
  startBoostRun: (theme: string, connectionId?: string, groupId?: string) =>
    rpc<BoostRunState>('start_boost_run', { p_connection: connectionId ?? null, p_group: groupId ?? null, p_theme: theme }),
  answerBoostRun: (runId: string, choice: number | null) => rpc<BoostRunState>('answer_boost_run', { p_run: runId, p_choice: choice }),
  getBoostRun: (runId: string) => rpc<BoostRunState>('get_boost_run', { p_run: runId }),
  launchBoost: (connectionId?: string, groupId?: string) =>
    rpc<string>('launch_boost', { p_connection: connectionId ?? null, p_group: groupId ?? null }),
  getBoost: (id: string) => rpc<BoostInfo>('get_boost', { p_challenge: id }),
  matchMinigame: (matchId: string) => rpc<string>('match_minigame', { p_match: matchId }),
  startBoostGame: (id: string) => rpc<{ game: BoostGame; content: BoostContent }>('start_boost_game', { p_challenge: id }),
  submitBoostGame: (id: string, payload: Record<string, unknown>) =>
    rpc<{ display: string; ok: boolean }>('submit_boost_game', { p_challenge: id, p_payload: payload }),
  standings: (connectionId?: string, groupId?: string) =>
    rpc<{ user_id: string; pseudo: string; points: number; wins: number; rank: number }[]>(
      'season_standings', { p_connection: connectionId ?? null, p_group: groupId ?? null }),
  myCard: async () => {
    const { data } = await supabase.from('cards').select('id, expires_at')
      .is('used_at', null).gt('expires_at', new Date().toISOString()).order('expires_at').limit(1);
    return ((data ?? []) as { id: string; expires_at: string }[])[0] ?? null;
  },
  createInvite: (groupId?: string) => rpc<string>('create_invite', { p_group: groupId ?? null }),
  acceptInvite: (code: string) => rpc<{ connection_id?: string; group_id?: string; group_name?: string }>('accept_invite', { p_code: code }),
  createGroup: (name: string) => rpc<string>('create_group', { p_name: name }),
  addToGroup: (groupId: string, userId: string) => rpc<string>('add_to_group', { p_group: groupId, p_user: userId }),
  deleteConnection: (connectionId: string) => rpc<void>('delete_connection', { p_connection: connectionId }),
  leaveGroup: (groupId: string) => rpc<void>('leave_group', { p_group: groupId }),
  removeFromGroup: (groupId: string, userId: string) => rpc<void>('remove_from_group', { p_group: groupId, p_user: userId }),
  deleteGroup: (groupId: string) => rpc<void>('delete_group', { p_group: groupId }),
  myStats: () => rpc<MyStats>('my_stats'),
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
