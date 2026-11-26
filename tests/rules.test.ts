import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES, answerPoints, mineMultiplier, scoreMatch, validateMines, addBonus,
  cardExpiresAt, isCardUsable, resolveTitle, longestWinStreak, canUseJoker,
  matchWindow, jokerDeadline,
} from '../src/engine/rules.ts';

const right = (sure = false) => ({ choiceIndex: 2, correctIndex: 2, sure });
const wrong = (sure = false) => ({ choiceIndex: 1, correctIndex: 2, sure });

test('barème : normal ±1, Sûr ±3', () => {
  assert.equal(answerPoints(right()), 1);
  assert.equal(answerPoints(wrong()), -1);
  assert.equal(answerPoints(right(true)), 3);
  assert.equal(answerPoints(wrong(true)), -3);
});

test('pas de réponse dans les 15 s = réponse fausse', () => {
  assert.equal(answerPoints({ choiceIndex: null, correctIndex: 0, sure: false }), -1);
});

test('mines : elles s\'additionnent (1 = ×2, 2 = ×3, 3 = ×4)', () => {
  assert.equal(mineMultiplier(0), 1);
  assert.equal(mineMultiplier(1), 2);
  assert.equal(mineMultiplier(2), 3);
  assert.equal(mineMultiplier(3), 4);
});

test('une mine ne touche que les mauvaises réponses', () => {
  assert.equal(answerPoints(right(true), 3), 3);
  assert.equal(answerPoints(wrong(true), 1), -6);
  assert.equal(answerPoints(wrong(false), 2), -3);
  assert.equal(answerPoints(wrong(true), 3), -12);
});

test('carte Who da Boss ? : tout est doublé, pertes comprises', () => {
  assert.equal(answerPoints(right(), 0, 2), 2);
  assert.equal(answerPoints(right(true), 0, 2), 6);
  assert.equal(answerPoints(wrong(true), 0, 2), -6);
});

test('partie : mines, bonus et classement', () => {
  const res = scoreMatch(
    [
      { userId: 'victor', answers: [right(true), right(true), right(true), wrong(), right()], totalMs: 30000 },
      { userId: 'lea', answers: [right(), wrong(true), right(), right(), right()], totalMs: 25000 },
    ],
    [{ userId: 'victor', questionIndex: 1 }],
  );
  const victor = res.players.find((p) => p.userId === 'victor')!;
  const lea = res.players.find((p) => p.userId === 'lea')!;
  assert.equal(victor.points, 3 + 3 + 3 - 1 + 1);
  assert.equal(lea.points, 1 - 6 + 1 + 1 + 1);
  assert.equal(lea.minesHit, 1);
  assert.equal(res.winnerId, 'victor');
  assert.deepEqual(
    res.bonus.map((b) => `${b.userId}:${b.reason}`).sort(),
    ['victor:mine_triggered', 'victor:three_sure'],
  );
});

test('sa propre mine ne touche pas son auteur', () => {
  const res = scoreMatch(
    [{ userId: 'a', answers: [wrong(), right(), right(), right(), right()], totalMs: 1 }],
    [{ userId: 'a', questionIndex: 0 }],
  );
  assert.equal(res.players[0].points, -1 + 4);
});

test('forfait : 0 point et dernier ; égalité départagée au temps', () => {
  const five = [right(), right(), right(), right(), right()];
  const res = scoreMatch(
    [
      { userId: 'lent', answers: five, totalMs: 40000 },
      { userId: 'absent', answers: null, totalMs: 0 },
      { userId: 'rapide', answers: five, totalMs: 20000 },
    ],
    [],
  );
  assert.deepEqual(res.players.map((p) => p.userId), ['rapide', 'lent', 'absent']);
  assert.equal(res.players[2].points, 0);
  assert.equal(res.winnerId, 'rapide');
});

test('mines : une seule par joueur et par partie', () => {
  assert.equal(validateMines([{ userId: 'a', questionIndex: 0 }], ['a', 'b']), null);
  assert.match(validateMines([{ userId: 'a', questionIndex: 0 }, { userId: 'a', questionIndex: 3 }], ['a'])!, /une seule/);
  assert.match(validateMines([{ userId: 'a', questionIndex: 5 }], ['a'])!, /hors partie/);
});

test('3 points bonus = 1 carte, le reste est gardé', () => {
  assert.deepEqual(addBonus(2, 1), { balance: 0, newCards: 1 });
  assert.deepEqual(addBonus(2, 2), { balance: 1, newCards: 1 });
  assert.deepEqual(addBonus(0, 1), { balance: 1, newCards: 0 });
});

test('une carte se joue dans les 3 jours', () => {
  const earned = new Date('2026-11-25T10:00:00Z');
  assert.equal(cardExpiresAt(earned).toISOString(), '2026-11-28T10:00:00.000Z');
  assert.equal(isCardUsable(earned, new Date('2026-11-27T10:00:00Z'), null), true);
  assert.equal(isCardUsable(earned, new Date('2026-11-28T10:00:01Z'), null), false);
  assert.equal(isCardUsable(earned, new Date('2026-11-26T10:00:00Z'), new Date()), false);
});

test('titres : on ne vole un titre qu\'en faisant strictement mieux', () => {
  const holder = { userId: 'tom', value: 10 };
  assert.deepEqual(resolveTitle(holder, [{ userId: 'lea', value: 10 }]), holder);
  assert.deepEqual(resolveTitle(holder, [{ userId: 'lea', value: 11 }]), { userId: 'lea', value: 11 });
  assert.equal(resolveTitle(null, [{ userId: 'x', value: 0 }]), null);
});

test('L\'Infatigable : plus longue série de victoires', () => {
  assert.equal(longestWinStreak([true, true, false, true, true, true, false]), 3);
  assert.equal(longestWinStreak([]), 0);
});

test('fenêtre de jeu, forfait et joker', () => {
  const { opensAt, closesAt } = matchWindow(new Date(2026, 10, 25, 15, 30), 1);
  assert.equal(opensAt.getDate(), 25);
  assert.equal(closesAt.getDate(), 26);
  assert.equal(jokerDeadline(closesAt).getHours(), RULES.jokerDeadlineHour);
  const morning = new Date(2026, 10, 26, 9, 0);
  assert.equal(canUseJoker(morning, closesAt, 0), true);
  assert.equal(canUseJoker(morning, closesAt, 1), false);
  assert.equal(canUseJoker(new Date(2026, 10, 26, 13, 0), closesAt, 0), false);
  assert.equal(matchWindow(new Date(2026, 10, 25), 7).closesAt.getDate(), 2);
});
