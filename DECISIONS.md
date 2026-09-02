# DECISIONS

Chaque écart par rapport au mégaprompt, avec sa raison en une phrase (§15.8).

## Écarts et choix

- **`bcryptjs` au lieu de `bcrypt`** — le paquet natif `bcrypt` a des liaisons
  C++ qui compilent mal dans l'environnement serverless de Vercel ; `bcryptjs`
  est l'implémentation pure-JS, même API, coût 12 conservé.
- **Endpoint `/api/completions` ajouté** — non listé dans le tableau §6, mais la
  table `completions` du schéma et le champ `minutesMoved` de `/api/stats`
  l'exigent ; même contrat idempotent que `/api/events` (unicité
  `(user_id, client_id)`).
- **`/api/stats` prend `?today=`** — le jour doit être compté dans le fuseau de
  l'appareil (§5) ; le client envoie sa date locale, le serveur ne fait jamais
  `now()::date`.
- **Intervalle des rappels « yeux » fixé à 20 min** — le schéma ne stocke pas
  d'intervalle pour les yeux ; 20 min est la cadence de la règle 20-20-20 que
  l'app cite (et réfute), désactivée par défaut de toute façon (§8.1).
- **Route de la barre d'onglets `/library/:slug` pour le détail** — le mégaprompt
  liste `Player.tsx` et `Library.tsx` sans nommer l'écran de détail de routine ;
  il est rendu par `RoutineDetail.tsx` sous `/library/:slug`.
- **Fiche batterie : intent câblée via `@capawesome-team/capacitor-android-battery-optimization`**
  — `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` n'est pas exposé par le cœur
  de Capacitor ; ce plugin (MIT, Capacitor 8) l'expose sans code natif à
  maintenir. Le bouton de la fiche ouvre réellement la demande d'exemption, et
  l'état est relisible dans Réglages → Rappels, la fiche ne s'affichant qu'une
  fois. L'app n'est pas distribuée sur le Play Store, donc la restriction de
  Google sur cet intent ne s'applique pas.
- **Sons du minuteur synthétisés, réglage local** — trois bips Web Audio
  (changement d'étape, cinq dernières secondes, fin) plutôt que des fichiers
  audio : rien à charger, rien dans le bundle OTA. Le réglage vit dans le
  stockage de l'appareil et non dans `Settings`, que `/api/me` remplace en
  entier — l'y mettre coûterait une migration SQL pour un booléen. Activé par
  défaut, contrairement au son des notifications (§8.3) : un bip pendant une
  pause qu'on a lancée soi-même n'est pas une notification en open space.
- **Alarmes exactes** — `checkExactNotificationSetting` / `changeExactNotificationSetting`
  sont appelées via un accès typé souple ; si l'API n'existe pas (OS/plugin), on
  dégrade silencieusement vers des alarmes inexactes (§8.3). Jamais bloquant.
- **Contenu seedé généré** — `db/002_seed_content.sql` est **généré** depuis
  `src/content/*.json` par `scripts/gen-seed.ts` (lancé par `pretest`), pour que
  la base et le repli hors ligne ne puissent jamais diverger. Le contenu §12
  reste identique au mot près.
- **Base de données non appliquée depuis cette session** — l'hôte Neon n'est pas
  dans l'allowlist réseau de l'environnement de développement distant ; la
  migration est scriptée (`pnpm db:migrate`) et documentée (`db/README.md`), à
  exécuter une fois avec le rôle `releve_app`.
- **`versionName` natif = `1.0.0`** — aligné sur `ota/version.json` pour que la
  comparaison `minNative` de l'OTA soit cohérente (§9.3).

- **Bundle OTA écrit avec `jszip`, plus avec le binaire `zip`** — `zip` n'existe
  pas sur une installation Windows standard, donc `pnpm ota:local` ne pouvait pas
  tourner sur la machine où l'app est développée et l'étape de release n'était
  exerçable qu'en CI. `jszip` (devDependency, jamais dans le bundle) supprime la
  dépendance système, rend l'archive reproductible à l'octet (date fixe, pas
  d'entrées de dossier) et permet de vérifier ce qui a été écrit plutôt que ce
  qu'on croit avoir écrit. Le script refuse de publier une archive qui contient
  `ota/`, qui n'a pas d'`index.html` à sa racine, ou qui dépasse 20 Mo ; `ci.yml`
  fait tourner l'empaquetage à chaque PR pour que ces trois gardes se déclenchent
  avant `main`, et non après.

## À la charge du propriétaire (secrets, hors dépôt)

- Créer le rôle `releve_app` + la base `releve`, appliquer les migrations
  (`db/README.md`).
- Définir `DATABASE_URL`, `JWT_SECRET`, `INVITE_CODE`, `OTA_BASE_URL` côté
  Vercel (`.env.example`).
- Créer le keystore Android et renseigner `android/keystore.properties`
  (ou les secrets CI), voir README.
- **Sécurité** : les identifiants du rôle propriétaire Neon ont transité par le
  chat de mise en place ; il est recommandé de régénérer le mot de passe
  `neondb_owner` une fois la base `releve` créée.
