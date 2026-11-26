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
    signinTab: 'SE CONNECTER', signupTab: 'CRÉER UN COMPTE', password: 'Mot de passe', newPassword: 'Nouveau mot de passe',
    passwordHint: '6 caractères minimum', show: 'Voir', hide: 'Cacher', signin: 'C\'EST MOI !', signup: 'CRÉER MON COMPTE',
    forgot: 'Mot de passe oublié ?', resetTitle: 'NOUVEAU MOT DE PASSE', resetIntro: 'On t\'envoie un code par e-mail pour choisir un nouveau mot de passe.',
    resetSave: 'ENREGISTRER', back: '‹ Retour', resetDone: 'Mot de passe enregistré, c\'est parti !',
    badCredentials: 'E-mail ou mot de passe incorrect. Tu te connectais avant avec un code ? Utilise « Mot de passe oublié ? » pour créer ton mot de passe.',
    alreadyUsed: 'Un compte existe déjà avec cet e-mail : connecte-toi, ou utilise « Mot de passe oublié ? ».',
    checkEmail: 'Compte créé : confirme ton adresse avec l\'e-mail reçu, puis connecte-toi.',
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
    boost: 'BOOST !', boostTitle: 'QUESTION BONUS FLASH',
    boostOffer: 'Une question de plus, 10 secondes. Juste : +3 points dans cette partie et +1 point bonus. Faux : rien de perdu.',
    boostLeft: (n: number) => (n === 1 ? 'Il te reste 1 Boost cette semaine.' : `Il te reste ${n} Boosts cette semaine.`),
    boostGo: 'BOOST !', boostNo: 'Non merci, terminer', boostWin: 'BOOSTÉ ! +3', boostLose: 'RATÉ…', finishBtn: 'TERMINER',
    cardMatch: 'DÉFI ×2',
  },
  reveal: {
    boom: 'BOOM !', paf: 'PAF !', won: 'TU ES LE BOSS !', lost: 'PERDU...', mineHit: 'BOUM ! Sur ta mine',
    seeBoard: 'VOIR LE TABLEAU', points: (n: number) => `${n > 0 ? '+' : ''}${n} pts`, forfeit: 'forfait',
  },
  rivals: {
    title: 'MES RIVAUX', invite: 'DÉFIER UN AMI EN DUO', inviteShare: (url: string) => `Je te défie sur Who da Boss ? Clique pour accepter le duel : ${url}`,
    groupShare: (name: string, url: string) => `Rejoins mon groupe « ${name} » sur Who da Boss ? : ${url}`,
    group: 'CRÉER UN GROUPE', groupName: 'Nom du groupe (ex. : La famille)', haveCode: 'Code ou lien reçu', join: 'REJOINDRE',
    none: 'Défie un proche pour lancer ton premier duel : il recevra un lien par message.', report: 'Signaler', block: 'Bloquer',
    rhythm: (d: number) => (d === 1 ? 'tous les jours' : d === 7 ? '1 fois / semaine' : `tous les ${d} jours`),
    duos: 'MES DUOS', groups: 'MES GROUPES', addFriend: '+ AJOUTER UN AMI', full: 'GROUPE COMPLET',
    members: (n: number) => `${n} / 4 joueurs`, waitingMembers: 'Ajoute au moins un ami pour lancer les parties.',
    addTitle: (name: string) => `Ajouter à « ${name} »`, addHow: 'Choisis un rival ou envoie un lien d\'invitation.',
    sendLink: 'Envoyer un lien par message', changeRhythm: 'Changer le rythme', rhythmTitle: 'Rythme des parties',
    rhythmInfo: 'Modifiable une fois par mois.', options: 'Options', cancel: 'Annuler',
    linkReady: 'Lien prêt !', linkCopied: 'Le lien est copié : colle-le dans un message à ton ami.',
    joinedDuo: 'Duel accepté ! Votre première partie arrive.', joinedGroup: 'Bienvenue dans le groupe !',
    added: (who: string) => `${who} a rejoint le groupe.`, groupCreated: 'Groupe créé ! Ajoute tes amis.',
    howTo: 'Le lien ouvre Who da Boss ? : ton ami se connecte et vous êtes reliés automatiquement.',
  },
  board: {
    title: 'LE TABLEAU', duo: 'DUO', group: 'GROUPE', global: 'GÉNÉRAL', titles: 'LES TITRES',
    worldRank: 'CLASSEMENT MONDIAL', notRanked: 'Classé après 10 parties terminées.',
    holder: 'détenteur', you: 'TOI', nobody: 'personne pour l\'instant',
  },
  titles: {
    most_sure_correct: 'Mr je sais tout !', most_sure_wrong: 'Le pipoteur de service !',
    longest_streak_month: 'L\'Infatigable !', most_cards_won: 'Le Boss des Boss !', theme_boss: (t: string) => `Boss de ${t}`,
  },
  titleInfo: {
    most_sure_correct: 'Le plus de « SÛR ! » justes cette saison.',
    most_sure_wrong: 'Le plus de « SÛR ! » ratés cette saison.',
    longest_streak_month: 'La plus longue série de victoires du mois.',
    most_cards_won: 'Le plus de défis « carte Who da Boss ? » gagnés cette saison.',
    categories: 'CATÉGORIES',
    categoriesInfo: 'Un Boss par thème : celui qui a donné le plus de bonnes réponses dans ce thème cette saison.',
    steal: 'Pour voler un titre, il faut faire strictement mieux que son détenteur.',
  },
  profile: {
    title: 'PROFIL', bonus: (n: number) => `${n} / 3 points bonus`, cards: (n: number) => `${n} carte(s) Who da Boss ?`,
    language: 'Langue', logout: 'SE DÉCONNECTER', delete: 'Supprimer mon compte',
    deleteConfirm: 'Toutes tes parties, tes titres et tes réactions seront effacés. Continuer ?', cancel: 'Annuler', confirm: 'Supprimer',
    rules: 'LES RÈGLES DU JEU',
    playCard: 'JOUER MA CARTE ×2', cardUntil: (d: string) => `Ta carte est valable jusqu'au ${d}.`,
    cardWho: 'Défier qui ?', cardTheme: 'Sur quel thème ?', cardNoRival: 'Ajoute d\'abord un rival ou un groupe dans Rivaux.',
  },
  rules: {
    next: 'SUIVANT', prev: '‹ RETOUR', done: 'J\'AI COMPRIS, ON JOUE !', skip: 'Passer',
    pages: [
      { title: 'LE PRINCIPE', burst: 'DUEL !', lines: [
        'Chaque jour, un duel de 5 questions t\'attend avec chacun de tes rivaux et de tes groupes.',
        'Même thème, mêmes questions pour tout le monde. Tu joues quand tu veux, avant minuit.',
        'La révélation arrive quand tout le monde a joué : là, on voit qui est le Boss !',
      ] },
      { title: 'PAS DE PRIME À LA VITESSE', burst: '15 S', lines: [
        'Tu as 15 secondes par question. Sans réponse, elle compte comme fausse.',
        'Répondre vite ne rapporte aucun point de plus : prends le temps de réfléchir.',
        'La vitesse sert seulement à départager deux joueurs à égalité.',
      ] },
      { title: 'LES POINTS', burst: '+1', lines: [
        'Bonne réponse : +1 point.',
        'Mauvaise réponse : −1 point.',
        'Celui qui a le plus de points à la fin de la partie la gagne.',
      ] },
      { title: 'LE BOUTON « SÛR ! »', burst: 'SÛR !', lines: [
        'Certain de ta réponse ? Appuie sur « SÛR ! » avant de valider.',
        'Juste : +3 points. Faux : −3 points.',
        '3 « SÛR ! » justes dans la même partie te rapportent 1 point bonus.',
      ] },
      { title: 'LES MINES', burst: 'BOUM !', lines: [
        'Tu as une mine par partie. Pose-la sur la question que tu trouves la plus piégeuse.',
        'Si un rival se trompe sur ta mine, il perd deux fois plus (−2, ou −6 avec « SÛR ! »).',
        'Plusieurs mines sur la même question s\'additionnent : ×3, ×4. Ta propre mine ne te touche pas.',
        'Chaque rival qui saute sur ta mine te rapporte 1 point bonus.',
      ] },
      { title: 'LE BOOST', burst: 'BOOST !', lines: [
        'À la fin de tes 5 questions, lance un Boost : une question bonus flash de 10 secondes.',
        'Juste : +3 points dans la partie et +1 point bonus. Faux : rien de perdu.',
        '1 Boost par partie, 3 par semaine.',
      ] },
      { title: 'LA CARTE WHO DA BOSS ?', burst: '×2', lines: [
        'Tu gagnes 1 point bonus quand un rival saute sur ta mine, quand tu réussis 3 « SÛR ! » dans une partie, ou avec un Boost réussi.',
        '3 points bonus = 1 carte « Who da Boss ? », valable 3 jours. Joue-la depuis ton profil.',
        'Tu lances un défi sur le thème de ton choix, contre un rival ou tout ton groupe : tous tes points comptent double.',
        'Pour tes adversaires, seules les pertes comptent double : à eux de ne pas se tromper !',
      ] },
      { title: 'LES AUTRES RÈGLES', burst: '!!!', lines: [
        'Forfait : si tu ne joues pas à temps, tu marques 0 point et tu finis dernier.',
        'Rythme : tous les jours ou moins souvent, à régler avec chaque rival (une fois par mois).',
        'Les titres (Mr je sais tout !, L\'Infatigable !…) se volent en faisant strictement mieux que leur détenteur.',
      ] },
    ],
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
    signinTab: 'SIGN IN', signupTab: 'CREATE ACCOUNT', password: 'Password', newPassword: 'New password',
    passwordHint: 'At least 6 characters', show: 'Show', hide: 'Hide', signin: "IT'S ME!", signup: 'CREATE MY ACCOUNT',
    forgot: 'Forgot your password?', resetTitle: 'NEW PASSWORD', resetIntro: 'We email you a code so you can choose a new password.',
    resetSave: 'SAVE', back: '‹ Back', resetDone: "Password saved, let's go!",
    badCredentials: 'Wrong email or password. Used to sign in with a code? Use "Forgot your password?" to create one.',
    alreadyUsed: 'An account already exists with this email: sign in, or use "Forgot your password?".',
    checkEmail: 'Account created: confirm your address with the email you received, then sign in.',
  },
  onboarding: { title: 'WELCOME!', pseudo: 'Your nickname', themes: 'Pick at least 3 themes', go: "LET'S GO!" },
  duel: {
    question: (i) => `QUESTION ${i} / 5`, sure: 'SURE!', surePts: '+3 / −3',
    normalRule: 'Without "Sure", a right answer gives +1, a wrong one costs −1.',
    mine: 'MINE', mined: 'MINED!', mineTitle: 'TRAP THIS QUESTION!', mineRule: 'If they get it wrong: losses ×2',
    mineUsed: (q) => `Your mine is on question ${q}`, validate: 'CONFIRM!', quit: '‹ QUIT',
    waiting: 'WAITING FOR THE OTHERS', waitingText: 'Done! Results come when everyone has played.',
    timeUp: "TIME'S UP!",
    boost: 'BOOST!', boostTitle: 'FLASH BONUS QUESTION',
    boostOffer: 'One more question, 10 seconds. Right: +3 points in this game and +1 bonus point. Wrong: nothing lost.',
    boostLeft: (n) => (n === 1 ? '1 Boost left this week.' : `${n} Boosts left this week.`),
    boostGo: 'BOOST!', boostNo: 'No thanks, finish', boostWin: 'BOOSTED! +3', boostLose: 'MISSED…', finishBtn: 'FINISH',
    cardMatch: 'CHALLENGE ×2',
  },
  reveal: {
    boom: 'BOOM!', paf: 'POW!', won: "YOU'RE DA BOSS!", lost: 'LOST...', mineHit: 'BOOM! On your mine',
    seeBoard: 'SEE THE BOARD', points: (n) => `${n > 0 ? '+' : ''}${n} pts`, forfeit: 'forfeit',
  },
  rivals: {
    title: 'MY RIVALS', invite: 'CHALLENGE A FRIEND', inviteShare: (url) => `I challenge you on Who da Boss? Tap to accept the duel: ${url}`,
    groupShare: (name, url) => `Join my group "${name}" on Who da Boss?: ${url}`,
    group: 'CREATE A GROUP', groupName: 'Group name (e.g. The family)', haveCode: 'Code or link received', join: 'JOIN',
    none: 'Challenge someone close to start your first duel: they get a link by message.', report: 'Report', block: 'Block',
    rhythm: (d) => (d === 1 ? 'every day' : d === 7 ? 'once a week' : `every ${d} days`),
    duos: 'MY DUOS', groups: 'MY GROUPS', addFriend: '+ ADD A FRIEND', full: 'GROUP FULL',
    members: (n) => `${n} / 4 players`, waitingMembers: 'Add at least one friend to start the games.',
    addTitle: (name) => `Add to "${name}"`, addHow: 'Pick a rival or send an invite link.',
    sendLink: 'Send a link by message', changeRhythm: 'Change the rhythm', rhythmTitle: 'Game rhythm',
    rhythmInfo: 'Can be changed once a month.', options: 'Options', cancel: 'Cancel',
    linkReady: 'Link ready!', linkCopied: 'The link is copied: paste it in a message to your friend.',
    joinedDuo: 'Duel accepted! Your first game is coming.', joinedGroup: 'Welcome to the group!',
    added: (who) => `${who} joined the group.`, groupCreated: 'Group created! Add your friends.',
    howTo: 'The link opens Who da Boss?: your friend signs in and you are connected automatically.',
  },
  board: {
    title: 'THE BOARD', duo: 'DUO', group: 'GROUP', global: 'WORLD', titles: 'TITLES',
    worldRank: 'WORLD RANKING', notRanked: 'Ranked after 10 finished games.',
    holder: 'holder', you: 'YOU', nobody: 'nobody yet',
  },
  titles: {
    most_sure_correct: 'Mr Know-It-All!', most_sure_wrong: 'The Resident Bluffer!',
    longest_streak_month: 'The Unstoppable!', most_cards_won: 'Boss of Bosses!', theme_boss: (t) => `Boss of ${t}`,
  },
  titleInfo: {
    most_sure_correct: 'Most right "SURE!" answers this season.',
    most_sure_wrong: 'Most wrong "SURE!" answers this season.',
    longest_streak_month: 'Longest winning streak this month.',
    most_cards_won: 'Most "Who da Boss?" card challenges won this season.',
    categories: 'CATEGORIES',
    categoriesInfo: 'One Boss per theme: whoever gave the most right answers in that theme this season.',
    steal: 'To steal a title, you must do strictly better than its holder.',
  },
  profile: {
    title: 'PROFILE', bonus: (n) => `${n} / 3 bonus points`, cards: (n) => `${n} Who da Boss? card(s)`,
    language: 'Language', logout: 'SIGN OUT', delete: 'Delete my account',
    deleteConfirm: 'All your games, titles and reactions will be erased. Continue?', cancel: 'Cancel', confirm: 'Delete',
    rules: 'HOW TO PLAY',
    playCard: 'PLAY MY ×2 CARD', cardUntil: (d) => `Your card is valid until ${d}.`,
    cardWho: 'Challenge who?', cardTheme: 'Which theme?', cardNoRival: 'First add a rival or a group in Rivals.',
  },
  rules: {
    next: 'NEXT', prev: '‹ BACK', done: "GOT IT, LET'S PLAY!", skip: 'Skip',
    pages: [
      { title: 'THE IDEA', burst: 'DUEL!', lines: [
        'Every day, a 5-question duel waits for you with each of your rivals and groups.',
        'Same theme, same questions for everyone. Play whenever you like, before midnight.',
        'Results come when everyone has played: that is when we see who is da Boss!',
      ] },
      { title: 'NO SPEED BONUS', burst: '15 S', lines: [
        'You have 15 seconds per question. No answer counts as wrong.',
        'Answering fast gives no extra points: take time to think.',
        'Speed only breaks a tie between two players.',
      ] },
      { title: 'POINTS', burst: '+1', lines: [
        'Right answer: +1 point.',
        'Wrong answer: −1 point.',
        'Whoever has the most points at the end wins the game.',
      ] },
      { title: 'THE "SURE!" BUTTON', burst: 'SURE!', lines: [
        'Certain of your answer? Tap "SURE!" before confirming.',
        'Right: +3 points. Wrong: −3 points.',
        '3 right "SURE!" in the same game give you 1 bonus point.',
      ] },
      { title: 'MINES', burst: 'BOOM!', lines: [
        'You get one mine per game. Put it on the question you find trickiest.',
        'If a rival gets your mined question wrong, they lose twice as much (−2, or −6 with "SURE!").',
        'Several mines on one question add up: ×3, ×4. Your own mine never hits you.',
        'Each rival who steps on your mine gives you 1 bonus point.',
      ] },
      { title: 'THE BOOST', burst: 'BOOST!', lines: [
        'After your 5 questions, launch a Boost: a 10-second flash bonus question.',
        'Right: +3 points in the game and +1 bonus point. Wrong: nothing lost.',
        '1 Boost per game, 3 per week.',
      ] },
      { title: 'THE WHO DA BOSS? CARD', burst: '×2', lines: [
        'You earn 1 bonus point when a rival steps on your mine, when you get 3 right "SURE!" in a game, or with a right Boost.',
        '3 bonus points = 1 "Who da Boss?" card, valid for 3 days. Play it from your profile.',
        'You launch a challenge on the theme of your choice, against a rival or your whole group: all your points count double.',
        'For your opponents, only losses count double: they had better not slip up!',
      ] },
      { title: 'OTHER RULES', burst: '!!!', lines: [
        'Forfeit: if you do not play in time, you score 0 and finish last.',
        'Rhythm: every day or less often, set with each rival (once a month).',
        'Titles (Mr Know-It-All!, The Unstoppable!…) are stolen by doing strictly better than their holder.',
      ] },
    ],
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
