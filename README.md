# Who da Boss ?

Jeu de duels quotidiens entre proches : 5 questions de culture générale délire, le bouton **SÛR !** pour miser gros, la **mine** pour piéger les autres, un score qui court toute l'année.

- **App** : Expo / React Native (iPhone + Android), Expo Router, TypeScript.
- **Serveur** : Supabase (base Postgres, connexion, stockage, tâches automatiques, fonctions).
- **Règles du jeu** : écrites deux fois, et testées les deux fois.
  - `src/engine/rules.ts` : en TypeScript, pour l'app ;
  - `supabase/migrations/…_game.sql` : en SQL, pour le serveur, qui fait foi.

## Ce que contient cette première version

| Partie | État |
| --- | --- |
| Connexion Apple + code par e-mail | ✅ |
| Pseudo et thèmes préférés (3 minimum) | ✅ |
| Inviter un rival par lien, rejoindre avec un code | ✅ |
| Duel du jour : 5 questions, 15 s, SÛR ! (+3 / −3), réponse normale (+1 / −1) | ✅ |
| Mine : 1 par partie, pertes ×2, les mines s'additionnent (2 mines ×3, 3 mines ×4) | ✅ |
| Révélation quand tout le monde a joué, BOOM ! / PAF ! | ✅ |
| Forfait (0 point) | ✅ |
| Rythme par connexion : tous les jours, tous les X jours, 1 fois par semaine | ✅ |
| Groupes de 2 à 8 joueurs | ✅ création + invitation |
| Points bonus → carte Who da Boss ? (3 jours ; le lanceur double ses gains et ne perd rien, les autres doublent leurs pertes) | ✅ |
| Boost : 2 jetons en tombant dernier ; 6 mini-jeux (frappe éclair, rébus emoji, juste chiffre, réflexe, mémoire, chrono parfait) ; le gagnant marque sa place au classement (leader 0) | ✅ |
| Titres évolutifs (duo, groupe, mondial) | ✅ |
| Tableau DUO / GROUPE / GÉNÉRAL (rang mondial) | ✅ |
| Notifications « X a joué. À toi ! » | ✅ |
| Signaler / bloquer, suppression du compte (règles Apple) | ✅ |
| Français / anglais | ✅ |
| Paris et gages, réactions GIF, funny stats | ⏳ prochaine étape |

## Démarrer

### 1. Installer

```bash
npm install
npx expo install --fix      # aligne toutes les versions sur le SDK Expo installé
cp .env.example .env        # puis colle l'URL et la clé « anon » de Supabase
```

### 2. Créer la base Supabase

1. Crée un projet sur [supabase.com](https://supabase.com) (région Europe).
2. Dans **Database > Extensions**, active **pg_cron**.
3. Envoie le schéma et les questions :
   ```bash
   npx supabase login
   npx supabase link --project-ref TON_PROJECT_REF
   npx supabase db push                                  # migrations 0001 à 0003
   psql "$(npx supabase db url)" -f supabase/seed.sql    # ou colle seed.sql dans le SQL Editor
   ```
4. **Authentication > Providers** :
   - **Email** : active la connexion par code. Dans le modèle d'e-mail « Magic Link », affiche le code avec `{{ .Token }}`. Tu peux brancher Resend dans **SMTP Settings**, comme pour Hellomoïra.
   - **Apple** : renseigne l'identifiant de l'app, `com.whodaboss.app`.
5. Déploie les deux fonctions :
   ```bash
   npx supabase functions deploy delete-account notify-players
   ```

### 3. Lancer sur ton téléphone

```bash
npx eas init                  # crée le projet EAS et remplit extra.eas.projectId
npx eas build --profile development --platform ios
npx expo start --dev-client
```

La connexion Apple et les notifications demandent ce « development build ». Pour un premier essai rapide, Expo Go suffit, avec la connexion par e-mail.

### 4. Version web à tester sur iPhone (Render)

Comme pour Hellomoïra, l'app existe aussi en version web, hébergée sur Render : on l'ouvre avec un lien dans Safari, puis **Partager → Sur l'écran d'accueil** pour l'avoir comme une app (icône, plein écran).

- Essai sur le Mac : `npm run web`.
- Compilation : `npm run build:web` (résultat dans `dist/`).
- Render : **New → Blueprint**, dépôt `vichfmn-design/Who-da-boss-`. Le fichier `render.yaml` crée un site statique gratuit, reconstruit à chaque push sur `main`. Renseigne `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` quand Render les demande.
- Supabase → **Authentication → URL Configuration** : mets l'adresse Render dans **Site URL**.
- Sur le web : connexion par code e-mail uniquement (pas de connexion Apple), pas de notifications push. Les fenêtres de dialogue et le partage d'invitation ont une version web (`src/lib/alert.web.tsx`, `src/lib/share.web.ts`).

## Tests

```bash
npm test          # moteur de règles (barème, mines, cartes, titres, joker)
npm run test:sql  # scénario complet sur un Postgres local
```

Le scénario SQL fait jouer un vrai duel : Victor pose une mine, Léa saute dessus, puis le test vérifie les scores (9 contre −4), les points bonus, la carte, les titres, le forfait, le joker et la sécurité. Il a besoin d'un Postgres local, par exemple avec `PGHOST=… PGUSER=postgres npm run test:sql`.

## Comment ça marche

- **Le serveur décide de tout.** L'app n'envoie que des choix (réponse, Sûr, mine). Les points, les mines, les bonus et les titres sont calculés par les fonctions SQL. La bonne réponse n'est jamais envoyée au téléphone avant la révélation.
- **Toutes les 10 minutes**, `tick()` clôt les parties terminées et ouvre celles du jour (à minuit, heure du joueur).
- **Toutes les heures**, `refresh_titles()` recalcule les titres. On ne vole un titre qu'en faisant **strictement** mieux que son détenteur.
- **La révélation** arrive dès que tout le monde a joué, sinon à minuit. Si quelqu'un a utilisé son joker, elle attend jusqu'à midi le lendemain.

## Précisions de règles

- **Mines** : 1 mine = pertes ×2, 2 mines = ×3, 3 mines = ×4 (le maximum dans un groupe de 4).
- **+1 point bonus** pour chaque joueur qui saute sur ta mine.
- **Question sans réponse en 15 s** : elle compte comme fausse (−1).

## Arborescence

```
app/                 écrans (Expo Router)
  (tabs)/            Jouer, Rivaux, Tableau, Profil
  duel/[id].tsx      le duel (Sûr !, mine, chrono)
  reveal/[id].tsx    la révélation
src/
  engine/rules.ts    règles du jeu en TypeScript
  components/comic   explosions, bulles, étoiles, bombe, fond à lignes de vitesse
  lib/               Supabase, appels serveur, notifications, session
  i18n.ts            textes FR / EN
  theme.ts           couleurs, polices, formes
supabase/
  migrations/        schéma, règles du jeu, tâches automatiques
  functions/         suppression de compte, notifications
  seed.sql           thèmes et premières questions
  tests/             scénario SQL de bout en bout
tests/               tests du moteur de règles
```
