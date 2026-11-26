/**
 * Who da Boss ? — moteur de règles.
 *
 * TypeScript pur, sans dépendance : utilisé par l'app pour afficher les
 * points et par les tests comme référence des règles. Le serveur
 * (supabase/migrations) applique exactement les mêmes règles en SQL :
 * si tu changes une règle ici, change-la aussi là-bas.
 */

export const RULES = {
  questionsPerMatch: 5,
  secondsPerQuestion: 15,
  choicesPerQuestion: 4,

  /** Réponse normale : +1 si juste, −1 si fausse. */
  normal: { correct: 1, wrong: -1 },
  /** Avec « Sûr ! » : +3 si juste, −3 si fausse. */
  sure: { correct: 3, wrong: -3 },

  /** Une mine par joueur et par partie (duo comme groupe). */
  minesPerPlayerPerMatch: 1,
  /** Point bonus pour chaque joueur qui saute sur ta mine. */
  bonusPerMineTriggered: 1,
  /** Point bonus pour 3 « Sûr » justes dans la même partie. */
  bonusForThreeSure: 1,

  bonusPointsPerCard: 3,
  cardValidityDays: 3,
  cardMultiplier: 2,

  boostsPerWeek: 3,
  boostReward: { score: 3, bonus: 1 },

  jokersPerWeek: 1,
  /** Le joker permet de rattraper un duel jusqu'à midi le lendemain. */
  jokerDeadlineHour: 12,

  maxGroupSize: 4,
  rhythmDays: { min: 1, max: 7 },
} as const;

/* ------------------------------------------------------------------ */
/* Points d'une réponse                                                */
/* ------------------------------------------------------------------ */

/**
 * Multiplicateur des pertes selon le nombre de mines posées par les AUTRES
 * joueurs sur la question : les mines s'additionnent.
 * 0 mine = ×1, 1 mine = ×2, 2 mines = ×3, 3 mines = ×4 (le maximum à 4 joueurs).
 */
export function mineMultiplier(minesFromOthers: number): number {
  if (minesFromOthers <= 0) return 1;
  return minesFromOthers + 1;
}

export type AnswerInput = {
  /** null = pas de réponse dans les 15 secondes (compte comme fausse). */
  choiceIndex: number | null;
  correctIndex: number;
  sure: boolean;
};

export function isCorrect(a: AnswerInput): boolean {
  return a.choiceIndex !== null && a.choiceIndex === a.correctIndex;
}

/**
 * Points d'une réponse. Les mines ne touchent que les mauvaises réponses.
 * Carte Who da Boss ? : celui qui lance le défi voit tous ses points doublés,
 * gains comme pertes ; pour les autres, seules les pertes sont doublées.
 */
export function answerPoints(
  a: AnswerInput,
  minesFromOthers = 0,
  cardMultiplier = 1,
  isChallenger = true,
): number {
  const table = a.sure ? RULES.sure : RULES.normal;
  if (isCorrect(a)) return table.correct * (isChallenger ? cardMultiplier : 1);
  return table.wrong * mineMultiplier(minesFromOthers) * cardMultiplier;
}

/* ------------------------------------------------------------------ */
/* Score d'une partie                                                  */
/* ------------------------------------------------------------------ */

export type Mine = { userId: string; questionIndex: number };

export type PlayerSheet = {
  userId: string;
  /** null = forfait (n'a pas joué avant la fin de la fenêtre). */
  answers: AnswerInput[] | null;
  /** Temps total de réponse, sert à départager les égalités. */
  totalMs: number;
};

export type PlayerResult = {
  userId: string;
  points: number;
  forfeit: boolean;
  correctCount: number;
  sureCorrect: number;
  sureWrong: number;
  /** Nombre de fois où ce joueur a sauté sur la mine d'un autre. */
  minesHit: number;
  rank: number;
};

export type BonusEvent = { userId: string; delta: number; reason: 'mine_triggered' | 'three_sure' };

export type MatchResult = {
  players: PlayerResult[];
  winnerId: string | null;
  bonus: BonusEvent[];
};

export function validateMines(mines: Mine[], playerIds: string[]): string | null {
  const seen = new Set<string>();
  for (const m of mines) {
    if (!playerIds.includes(m.userId)) return `mine d'un joueur inconnu : ${m.userId}`;
    if (m.questionIndex < 0 || m.questionIndex >= RULES.questionsPerMatch) return 'question hors partie';
    if (seen.has(m.userId)) return 'une seule mine par joueur et par partie';
    seen.add(m.userId);
  }
  return null;
}

export function scoreMatch(
  sheets: PlayerSheet[],
  mines: Mine[],
  opts: { cardMultiplier?: number; challengerId?: string | null } = {},
): MatchResult {
  const mult = opts.cardMultiplier ?? 1;
  const isChallenger = (userId: string) => !opts.challengerId || opts.challengerId === userId;
  const bonus: BonusEvent[] = [];

  const results = sheets.map((sheet): PlayerResult & { totalMs: number } => {
    const base = {
      userId: sheet.userId, points: 0, forfeit: false, correctCount: 0,
      sureCorrect: 0, sureWrong: 0, minesHit: 0, rank: 0, totalMs: sheet.totalMs,
    };
    if (sheet.answers === null) return { ...base, forfeit: true, totalMs: Infinity };

    sheet.answers.forEach((a, q) => {
      const minersHere = mines.filter((m) => m.questionIndex === q && m.userId !== sheet.userId);
      const ok = isCorrect(a);
      base.points += answerPoints(a, minersHere.length, mult, isChallenger(sheet.userId));
      if (ok) base.correctCount += 1;
      if (a.sure && ok) base.sureCorrect += 1;
      if (a.sure && !ok) base.sureWrong += 1;
      if (!ok && minersHere.length > 0) {
        base.minesHit += 1;
        for (const m of minersHere) {
          bonus.push({ userId: m.userId, delta: RULES.bonusPerMineTriggered, reason: 'mine_triggered' });
        }
      }
    });
    if (base.sureCorrect >= 3) {
      bonus.push({ userId: sheet.userId, delta: RULES.bonusForThreeSure, reason: 'three_sure' });
    }
    return base;
  });

  // Classement : points décroissants, puis temps croissant. Les forfaits en dernier.
  const ordered = [...results].sort((a, b) => {
    if (a.forfeit !== b.forfeit) return a.forfeit ? 1 : -1;
    if (b.points !== a.points) return b.points - a.points;
    return a.totalMs - b.totalMs;
  });
  ordered.forEach((r, i) => { r.rank = i + 1; });

  const played = ordered.filter((r) => !r.forfeit);
  const winnerId = played.length > 0 ? played[0].userId : null;

  return {
    players: ordered.map(({ totalMs: _t, ...r }) => r),
    winnerId,
    bonus,
  };
}

/* ------------------------------------------------------------------ */
/* Rythme, forfait et joker                                            */
/* ------------------------------------------------------------------ */

export function clampRhythm(days: number): number {
  return Math.min(RULES.rhythmDays.max, Math.max(RULES.rhythmDays.min, Math.round(days)));
}

/** Fenêtre de jeu : du début du jour J à minuit du dernier jour (heure locale). */
export function matchWindow(start: Date, rhythmDays: number): { opensAt: Date; closesAt: Date } {
  const opensAt = new Date(start);
  opensAt.setHours(0, 0, 0, 0);
  const closesAt = new Date(opensAt);
  closesAt.setDate(closesAt.getDate() + clampRhythm(rhythmDays));
  return { opensAt, closesAt };
}

export function jokerDeadline(closesAt: Date): Date {
  const d = new Date(closesAt);
  d.setHours(RULES.jokerDeadlineHour, 0, 0, 0);
  return d;
}

export function canUseJoker(now: Date, closesAt: Date, jokersUsedThisWeek: number): boolean {
  return jokersUsedThisWeek < RULES.jokersPerWeek && now >= closesAt && now < jokerDeadline(closesAt);
}

/* ------------------------------------------------------------------ */
/* Points bonus et cartes Who da Boss ?                                */
/* ------------------------------------------------------------------ */

/** Ajoute des points bonus ; chaque tranche de 3 devient une carte. */
export function addBonus(balance: number, delta: number): { balance: number; newCards: number } {
  const total = balance + delta;
  const newCards = Math.floor(total / RULES.bonusPointsPerCard);
  return { balance: total - newCards * RULES.bonusPointsPerCard, newCards };
}

export function cardExpiresAt(earnedAt: Date): Date {
  return new Date(earnedAt.getTime() + RULES.cardValidityDays * 24 * 3600 * 1000);
}

export function isCardUsable(earnedAt: Date, now: Date, usedAt: Date | null): boolean {
  return usedAt === null && now < cardExpiresAt(earnedAt);
}

/* ------------------------------------------------------------------ */
/* Titres évolutifs                                                    */
/* ------------------------------------------------------------------ */

export type TitleKey =
  | 'most_sure_correct'   // La personne la plus sûre !
  | 'most_sure_wrong'     // La personne qui s'y croit trop !
  | 'longest_streak_month' // L'Infatigable (remis à zéro chaque mois)
  | 'most_cards_won'      // Le Boss des Boss
  | `theme_boss:${string}`; // Boss de [thème]

export type Holder = { userId: string; value: number };

/**
 * Le détenteur garde son titre tant que personne ne fait STRICTEMENT mieux.
 * Renvoie le nouveau détenteur (ou l'ancien).
 */
export function resolveTitle(current: Holder | null, candidates: Holder[]): Holder | null {
  let best = current;
  for (const c of candidates) {
    if (c.value <= 0) continue;
    if (best === null || c.value > best.value) best = c;
    else if (c.userId === best.userId) best = { ...best, value: Math.max(best.value, c.value) };
  }
  return best;
}

/** Plus longue série de victoires consécutives dans une liste de résultats. */
export function longestWinStreak(results: boolean[]): number {
  let best = 0;
  let cur = 0;
  for (const won of results) {
    cur = won ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

/** Clé de mois (pour remettre L'Infatigable à zéro chaque mois). */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
