// Textes de l'app en français et en anglais. La langue suit le téléphone,
// puis le choix fait dans le profil.
import { getLocales } from 'expo-localization';

const fr = {
  appName: 'WHO DA BOSS ?',
  tapToPlay: 'TOUCHE POUR JOUER',
  duelsWaiting: (n: number) => (n === 0 ? 'AUCUN DUEL EN ATTENTE' : n === 1 ? '1 DUEL T\'ATTEND !' : `${n} DUELS T'ATTENDENT !`),
  waitingFor: (who: string) => `${who} doit encore jouer`,
  yourTurn: (who: string) => `${who} a déjà joué. À toi !`,
  tabs: { play: 'JOUER', rivals: 'RIVAUX', board: 'TABLEAU', profile: 'PROFIL' },
  login: {
    title: 'CONNEXION', withApple: 'Continuer avec Apple', email: 'Ton e-mail', sendCode: 'RECEVOIR UN CODE',
    code: 'Code reçu par e-mail', verify: 'VALIDER', codeSent: 'Code envoyé, regarde tes e-mails.',
  },
  onboarding: {
    title: 'BIENVENUE !', pseudo: 'Ton pseudo', themes: 'Choisis au moins 3 thèmes', go: 'C\'EST PARTI !',
  },
  duel: {
    question: (i: number) => `QUESTION ${i} / 5`, sure: 'SÛR !', surePts: '+3 / −3',
    normalRule: 'Sans « Sûr », une bonne réponse rapporte +1, une mauvaise coûte −1.',
    mine: 'MINE', mined: 'MINÉE !', mineTitle: 'PIÈGE CETTE QUESTION !', mineRule: "S'ils se trompent : pertes ×2",
    mineUsed: (q: number) => `Ta mine est sur la question ${q}`, validate: 'VALIDER !', quit: '‹ QUITTER',
    waiting: 'EN ATTENTE DES AUTRES', waitingText: 'Tu as fini ! La révélation arrive quand tout le monde a joué.',
    timeUp: 'TEMPS ÉCOULÉ !',
  },
  reveal: {
    boom: 'BOOM !', paf: 'PAF !', won: 'TU ES LE BOSS !', lost: 'PERDU...', mineHit: 'BOUM ! Sur ta mine',
    seeBoard: 'VOIR LE TABLEAU', points: (n: number) => `${n > 0 ? '+' : ''}${n} pts`, forfeit: 'forfait',
  },
  rivals: {
    title: 'MES RIVAUX', invite: 'INVITER UN RIVAL', inviteShare: (url: string) => `Viens me défier sur Who da Boss ? ${url}`,
    group: 'CRÉER UN GROUPE', groupName: 'Nom du groupe', haveCode: 'J\'ai un code', join: 'REJOINDRE',
    none: 'Invite un proche pour lancer ton premier duel.', report: 'Signaler', block: 'Bloquer',
    rhythm: (d: number) => (d === 1 ? 'tous les jours' : d === 7 ? '1 fois / semaine' : `tous les ${d} jours`),
  },
  board: {
    title: 'LE TABLEAU', duo: 'DUO', group: 'GROUPE', global: 'GÉNÉRAL', titles: 'LES TITRES',
    worldRank: 'CLASSEMENT MONDIAL', notRanked: 'Classé après 10 parties terminées.',
    holder: 'détenteur', you: 'TOI', nobody: 'personne pour l\'instant',
  },
  titles: {
    most_sure_correct: 'La personne la plus sûre !', most_sure_wrong: 'La personne qui s\'y croit trop !',
    longest_streak_month: 'L\'Infatigable', most_cards_won: 'Le Boss des Boss', theme_boss: (t: string) => `Boss de ${t}`,
  },
  profile: {
    title: 'PROFIL', bonus: (n: number) => `${n} / 3 points bonus`, cards: (n: number) => `${n} carte(s) Who da Boss ?`,
    language: 'Langue', logout: 'SE DÉCONNECTER', delete: 'Supprimer mon compte',
    deleteConfirm: 'Toutes tes parties, tes titres et tes réactions seront effacés. Continuer ?', cancel: 'Annuler', confirm: 'Supprimer',
  },
  errors: { generic: 'Oups, quelque chose a raté. Réessaie.' },
};

type Dict = typeof fr;

const en: Dict = {
  appName: 'WHO DA BOSS?',
  tapToPlay: 'TAP TO PLAY',
  duelsWaiting: (n) => (n === 0 ? 'NO DUEL WAITING' : n === 1 ? '1 DUEL IS WAITING!' : `${n} DUELS ARE WAITING!`),
  waitingFor: (who) => `${who} still has to play`,
  yourTurn: (who) => `${who} has played. Your turn!`,
  tabs: { play: 'PLAY', rivals: 'RIVALS', board: 'BOARD', profile: 'PROFILE' },
  login: {
    title: 'SIGN IN', withApple: 'Continue with Apple', email: 'Your email', sendCode: 'GET A CODE',
    code: 'Code from your email', verify: 'CONFIRM', codeSent: 'Code sent, check your inbox.',
  },
  onboarding: { title: 'WELCOME!', pseudo: 'Your nickname', themes: 'Pick at least 3 themes', go: "LET'S GO!" },
  duel: {
    question: (i) => `QUESTION ${i} / 5`, sure: 'SURE!', surePts: '+3 / −3',
    normalRule: 'Without "Sure", a right answer gives +1, a wrong one costs −1.',
    mine: 'MINE', mined: 'MINED!', mineTitle: 'TRAP THIS QUESTION!', mineRule: 'If they get it wrong: losses ×2',
    mineUsed: (q) => `Your mine is on question ${q}`, validate: 'CONFIRM!', quit: '‹ QUIT',
    waiting: 'WAITING FOR THE OTHERS', waitingText: 'Done! Results come when everyone has played.',
    timeUp: "TIME'S UP!",
  },
  reveal: {
    boom: 'BOOM!', paf: 'POW!', won: "YOU'RE DA BOSS!", lost: 'LOST...', mineHit: 'BOOM! On your mine',
    seeBoard: 'SEE THE BOARD', points: (n) => `${n > 0 ? '+' : ''}${n} pts`, forfeit: 'forfeit',
  },
  rivals: {
    title: 'MY RIVALS', invite: 'INVITE A RIVAL', inviteShare: (url) => `Come and challenge me on Who da Boss? ${url}`,
    group: 'CREATE A GROUP', groupName: 'Group name', haveCode: 'I have a code', join: 'JOIN',
    none: 'Invite someone close to start your first duel.', report: 'Report', block: 'Block',
    rhythm: (d) => (d === 1 ? 'every day' : d === 7 ? 'once a week' : `every ${d} days`),
  },
  board: {
    title: 'THE BOARD', duo: 'DUO', group: 'GROUP', global: 'WORLD', titles: 'TITLES',
    worldRank: 'WORLD RANKING', notRanked: 'Ranked after 10 finished games.',
    holder: 'holder', you: 'YOU', nobody: 'nobody yet',
  },
  titles: {
    most_sure_correct: 'The surest one!', most_sure_wrong: 'Too sure of themselves!',
    longest_streak_month: 'The Unstoppable', most_cards_won: 'Boss of Bosses', theme_boss: (t) => `Boss of ${t}`,
  },
  profile: {
    title: 'PROFILE', bonus: (n) => `${n} / 3 bonus points`, cards: (n) => `${n} Who da Boss? card(s)`,
    language: 'Language', logout: 'SIGN OUT', delete: 'Delete my account',
    deleteConfirm: 'All your games, titles and reactions will be erased. Continue?', cancel: 'Cancel', confirm: 'Delete',
  },
  errors: { generic: 'Oops, something went wrong. Try again.' },
};

export type Lang = 'fr' | 'en';
const dicts: Record<Lang, Dict> = { fr, en };

export function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode ?? 'fr';
  return code === 'en' ? 'en' : 'fr';
}

let current: Lang = deviceLang();
export const setLang = (l: Lang) => { current = l; };
export const getLang = () => current;
export const t = () => dicts[current];
