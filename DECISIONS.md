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
- **Réveil de l'écran : plugin natif `ScreenWake`** — `@capacitor/local-notifications`
  ne sait pas poser de *full-screen intent*, seul moyen sanctionné par Android
  pour qu'une app en arrière-plan démarre une activité. Chaque occurrence est
  donc doublée d'une alarme native (`WakeReceiver`) qui ne fait rien tant que
  l'écran est allumé — la notification ordinaire a déjà fait son travail — et
  qui, écran éteint, poste une notification silencieuse à full-screen intent :
  Android rallume l'écran et affiche la page « Commencer » par-dessus le
  verrouillage. `MainActivity` ne pose `showWhenLocked`/`turnScreenOn` que pour
  ce lancement-là, jamais pour une ouverture à la main. Le moteur de rappels
  reste entièrement en JavaScript ; le plugin n'y ajoute que ça. Côté JS chaque
  appel est en `try/catch` : un bundle OTA peut atterrir sur un APK antérieur au
  plugin, et un plugin manquant ne doit jamais empêcher une session de démarrer.
- **4e autorisation, « Alertes plein écran »** — depuis Android 14
  `USE_FULL_SCREEN_INTENT` n'est plus accordée à l'installation aux apps qui ne
  sont ni téléphone ni réveil ; elle se demande via
  `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`. Elle rejoint les trois autres dans
  la fiche (§8.3) et se lit comme accordée en dessous d'Android 14 ou si le
  plugin est absent, pour la même raison que les alarmes exactes.
- **La grille s'arrête pendant l'exercice** — `pauseForBreak` / `resumeFromBreak`
  annulent tout ce qui est en attente tant que la page d'alerte ou le lecteur
  sont à l'écran, et replanifient **depuis la fin** de l'exercice. Sans ça un
  rappel pouvait tomber pendant celui qu'on était en train de faire, et le
  suivant arrivait un intervalle après le *début* de la pause. Un « +10 min »
  pris pendant l'arrêt survit à la reprise (fusion par id). `topUpIfNeeded` ne
  fait rien tant que c'est en pause, sinon le foreground annulerait l'arrêt.
- **La page d'alerte s'ouvre seule** — `localNotificationReceived` navigue vers
  `/alerte/:kind` sans attendre de tap, sauf si une routine est déjà à l'écran :
  un rappel n'interrompt jamais l'exercice en cours.
- **Un seul rappel armé à la fois, au lieu de la grille de 8 h (§8.2)** — la
  grille voulait dire qu'un rappel manqué était simplement suivi du suivant à
  l'heure, et que la journée continuait sans toi. Le moteur n'arme donc plus que
  la prochaine occurrence ; quand elle tombe sans réponse, **rien** ne suit.
  `catchUp()` compare l'horloge aux occurrences armées à chaque passage au
  premier plan et au démarrage : une occurrence dont l'heure est passée devient
  une attente (`awaiting`), consignée en `expired`, et l'app ouvre la page de
  l'exercice au lieu de l'accueil. L'attente ne se lève que sur une réponse
  réelle — Fait, +10 min, routine terminée, journée arrêtée — jamais parce que
  la page s'est affichée. C'est ce qui rend un rappel manqué impossible à
  contourner en fermant l'app.
- **La pause rend le temps qu'elle a gelé** — mettre en pause enregistre ce
  qu'il restait avant le prochain rappel (`heldMs`/`heldKind`) ; reprendre le
  remet tel quel plutôt que de relancer un intervalle entier. Une réunion ne
  coûte pas les vingt minutes déjà attendues, et ne déclenche pas un rappel à
  la seconde où on se rassoit. Si l'instant rendu tombe dans une plage calme ou
  un jour exclu, on replanifie normalement.
- **L'exercice dû est une pop-up, pas une mention** — `BreakOverlay` est monté
  dans `AppLayout`, donc il s'impose par-dessus n'importe quel onglet, pour se
  lever, bouger ou cligner des yeux indifféremment. La route `/alerte/:kind` ne
  dessine plus rien : elle enregistre l'exercice dû et s'efface, pour qu'il n'y
  ait qu'une seule présentation d'une pause. Le lecteur et l'écran de connexion
  sont hors de `AppLayout`, donc jamais recouverts. La pop-up se ferme sans
  répondre, mais revient au passage au premier plan suivant (`catchUp` remet
  `promptDismissed` à faux) ; une pause la met en attente avec le reste et la
  reprise la rappelle.
- **Deux pauses distinctes** — `manual` est l'utilisateur qui s'éloigne du
  bureau et dure jusqu'à ce qu'il reprenne ; `break` dure le temps d'un exercice
  à l'écran. Elles sont séparées pour que fermer une routine ne relance pas une
  journée qu'on avait volontairement mise en attente. Une pause `break` de plus
  de 20 minutes est tenue pour abandonnée (l'app peut être tuée pendant l'écran
  d'exercice, et la journée ne repartirait jamais) ; une pause manuelle
  n'expire pas.
- **`versionCode` 2 / `versionName` `1.1.0`** — le plugin `ScreenWake` ne peut
  pas être livré par OTA : il faut réinstaller l'APK. Sans incrément, rien ne
  permettait de savoir laquelle des deux coques était installée. Réglages →
  À propos affiche désormais cette version (la ligne existait mais restait vide
  sur l'appareil), à côté de la version du contenu OTA qui, elle, bouge seule.
  `minNative` reste `1.0.0` : le bundle OTA continue de tourner sur l'ancienne
  coque, sans le réveil de l'écran (§9.3). Corollaire : `apk.yml` tire
  `VITE_BUNDLE_VERSION` de `ota/version.json` et non du tag git. Les deux
  numéros sont des lignes distinctes — la coque et le contenu — et les
  confondre voulait dire qu'un tag `v1.1.0` rendait tout bundle OTA ultérieur
  (1.0.11, 1.0.12…) plus ancien que l'APK : plus aucune mise à jour ne serait
  jamais descendue.
- **Pas de `script-shell` dans `.npmrc`** — un `script-shell=bash` corrigeait
  `pnpm apk` (cmd.exe ne résout pas `./gradlew`) mais cassait **tous** les autres
  scripts, `pnpm dev` compris : `bash` n'est pas sur le PATH d'une session
  PowerShell. `scripts/gradle.ts` lance le wrapper Gradle avec le nom qui
  convient à la plateforme, sans shell du tout.
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
