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
- **Frontière d'erreur autour du routeur** — rien n'existait avant : une
  exception de rendu vidait la page sans message, et le rollback OTA ne s'en
  protège pas (il ne surveille que les quelques secondes après
  `notifyAppReady()`, bien avant qu'un plantage comme celui-là puisse
  survenir). `ErrorBoundary` affiche un écran de secours avec un bouton
  Recharger, ce qui suffit dans le cas qui compte le plus : un mauvais bundle
  OTA revient sur la version précédente au prochain démarrage puisque le
  plugin garde l'ancien bundle jusqu'à confirmation. Un écouteur global
  `unhandledrejection` journalise ce qui échappe encore, en console
  uniquement — sans infrastructure de bannière globale pour un seul point
  d'écoute.
- **`start()`/`stop()` de session sont vraiment best-effort** — le commentaire
  du code le disait déjà, l'implémentation ne le tenait qu'à moitié : tout
  échec serveur qui n'était pas une coupure réseau (401, 500…) relançait
  l'exception après que l'état local avait déjà été écrit et affiché. Reproduit
  en local : `start()` plantait sur un 401 alors que la session tournait déjà à
  l'écran. Les deux ne relancent plus rien, seulement un `console.warn` ; l'UI
  de `Today.tsx` capte aussi ce qui pourrait encore remonter et l'affiche en
  ligne plutôt que de laisser le bouton tourner sur un rejet non géré. Pas de
  file de réessai pour `work_sessions` : la table n'est lue nulle part
  (`stats.ts` s'appuie sur `reminder_events` et `completions`), et rejouer un
  `INSERT` sans idempotance dupliquerait des lignes pour un usage qui n'existe
  pas encore.
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

- **Fiche d'exercice, une par mouvement distinct plutôt qu'une par occurrence
  d'étape** — 80 étapes existent dans les 13 routines, mais un mouvement comme
  la fente revient trois fois. Chaque étape porte désormais un `exerciseKey` qui
  pointe vers `exercises.json` (42 entrées) : le contenu ne se répète pas, et
  chaque étape garde sa propre consigne courte (`cue`) au-dessus de la fiche
  partagée. Confondre par erreur deux mouvements qui partagent une illustration
  (« Marche » et « Marche sur place », « Regard au loin » et « Loin, près ») les
  aurait décrits l'un comme l'autre ; les 42 clés ont été établies en relisant
  chaque étape, pas en dérivant automatiquement de `figureKey`. `content.test.ts`
  vérifie qu'aucune étape ne pointe vers une clé absente et qu'aucun exercice
  n'est orphelin.
- **`exercises` en base, séparée de `/api/routines`** — la fiche complète (pas à
  pas, astuces, adaptation, muscles, ce qu'il faut éviter) vit dans sa propre
  table et son propre endpoint `/api/exercises`, plutôt que d'être répétée dans
  chaque occurrence d'étape de `/api/routines` : l'intégrer partout aurait
  jusqu'à triplé le même texte sur le réseau et dans le bundle hors-ligne. Le
  store de contenu suit exactement le patron déjà en place pour les routines et
  les articles (copie locale, rafraîchissement en arrière-plan, échec silencieux).
- **`001_init.sql` modifié directement, pas de migration numérotée** — la base
  n'a jamais été appliquée depuis cette session (voir plus bas) ; ajouter la
  table `exercises` et la colonne `routine_steps.exercise_key` dans le schéma
  d'origine plutôt que dans un `003_*.sql` évite une migration inutile sur une
  base qui n'existe pas encore. `exercises` est upsertée avant les routines dans
  `gen-seed.ts` : la contrainte de clé étrangère l'exige.
- **Chaque étape de routine ouvre sa fiche au clic, dans `RoutineDetail`** — et
  le lecteur (`Player`) l'ouvre en feuille plutôt qu'en page : naviguer aurait
  démonté le lecteur et perdu l'étape en cours au retour. Le contenu des deux
  emplacements est le même composant (`ExerciseSections`), pour qu'une correction
  de texte ne se fasse qu'à un seul endroit.
- **Une alarme audible, réglable, silencieuse par défaut** — une notification
  muette pendant qu'on travaille ne sert à rien, mais l'app a été pensée pour
  l'open space (§8.3) : le choix est donc explicite et vit sur l'appareil
  (`silent` / `once` / `repeat`), pas dans `Settings` que `/api/me` remplace en
  entier. Le son est un **bol** synthétisé : trois sinus, dont deux désaccordés
  de 0,4 % pour produire le battement lent d'un bol frappé (1,5 Hz mesuré, 1,58
  théorique), attaque lente de 80 ms et 3,2 s de résonance. Choisi par le
  propriétaire dans une bibliothèque de sept propositions. Synthétisé et non
  échantillonné, comme les bips du lecteur : rien à charger, rien dans le bundle.
- **Le rappel dans un onglet de navigateur** — sur le téléphone c'est Android qui
  programme l'alarme ; un navigateur n'a pas d'équivalent sans service worker ni
  service de push, donc l'onglet surveille l'horloge lui-même (toutes les 5 s,
  en comparant à l'échéance plutôt qu'en décomptant, comme le lecteur). Limite
  assumée et mesurée : **un onglet en arrière-plan est bridé par Chrome à environ
  une exécution par minute**, donc un rappel peut arriver jusqu'à une minute en
  retard. Sur une cadence de trente minutes c'est sans conséquence, et le retour
  sur l'onglet déclenche une vérification immédiate.
- **Les timers de l'alarme sont testés hors navigateur** — piloter ça dans le
  dev-server donnait une alarme qui semblait survivre à la réponse. En réalité
  Vite sert deux instances d'un module rechargé à chaud, chacune avec ses
  propres handles de timer, donc le `stopAlerting` de l'une ne pouvait pas
  annuler l'intervalle armé par l'autre. `alert.test.ts` le vérifie avec des
  horloges factices et un seul exemplaire du module.

- **Routines composées par l'utilisateur, sur l'appareil** — mêmes raisons que
  les durées : `Settings` est remplacé en entier par `/api/me`, et une table
  dédiée coûterait migration, endpoints, synchronisation et règles de conflit
  pour un usage à un seul téléphone. Seuls les **choix** sont stockés (quel
  exercice, dans quel ordre, combien de temps) ; le nom, la consigne et
  l'illustration sont reconstruits depuis le catalogue à l'affichage, donc une
  correction de contenu atteint aussi les routines déjà composées. Le format
  stocké est transposable tel quel le jour où l'on voudra synchroniser.
- **Une routine perso est un `Routine` comme les autres** — `materialise()` la
  reconstruit dans la forme livrée, et `routineBySlug` la cherche en premier
  (son slug est préfixé `perso-`, donc aucune collision possible). La
  bibliothèque, l'écran de détail, le lecteur et la fiche d'exercice n'ont donc
  rien à savoir de son origine. Elle n'est en revanche pas rangée dans une zone
  du corps : elle a sa propre section dans la bibliothèque, ce qui évite
  d'ajouter une valeur au type `Zone` et une carte à l'accueil.
- **Les durées d'une routine perso ne s'éditent qu'au compositeur** — l'écran de
  détail masque ses boutons -/+ pour elles. Sinon la même durée aurait deux
  domiciles : les surcharges de `durations.ts`, indexées par slug et position,
  et la valeur stockée dans la routine elle-même.

- **Le bol est aussi une ressource Android (`res/raw/bol.wav`)** — quand l'app
  ne tourne pas, elle ne peut rien synthétiser : c'est Android qui doit jouer le
  son. Le fichier est rendu par le même calcul que la synthèse Web Audio, à
  22,05 kHz (le partiel le plus aigu est à 1069 Hz, très loin de la limite de
  Nyquist) : 154 Ko au lieu de 344, sans perte audible.
- **Deux canaux de notification, pas un réglage de son** — Android interdit de
  modifier le son d'un canal existant, ce qui explique que l'ancien bouton
  « Son des notifications » ne pouvait rien faire sur Android 8+ : le canal avait
  été créé muet. Il y a donc désormais un canal muet et un canal « bol », et
  c'est le mode d'alarme qui décide lequel reçoit la notification. L'ancien
  bouton a été retiré de Réglages plutôt que laissé à mentir ; le champ
  `settings.sound` reste en base, inutilisé, une migration pour un booléen ne se
  justifiant pas.
- **Le plein écran peut prendre l'écran allumé** — `WakeReceiver` ne s'effaçait
  que devant un écran déjà allumé, en supposant que la notification suffirait.
  C'est précisément la bannière qu'on traverse sans la voir quand on travaille.
  Le drapeau `wakeAlways`, mis quand l'utilisateur a choisi d'être alerté plutôt
  que notifié, lui fait prendre l'écran dans tous les cas.

- **Chaque cadence a son propre ancrage** — armer un seul rappel à la fois avait
  une conséquence que je n'avais pas vue : répondre replanifiait **tout** depuis
  cet instant, donc la cadence des yeux (20 min) devançait celle du debout
  (30 min) à chaque tour, et le rappel debout ne pouvait plus jamais tomber.
  `planNext` calcule désormais chaque type depuis son propre ancrage, et
  répondre ne déplace que celui du type répondu. Vérifié sur une matinée
  simulée : 09:20 yeux, 09:30 debout, 09:40 yeux, 10:00 debout…
- **Toute interaction délibérée coupe l'alarme** — ouvrir le lecteur, taper la
  notification ou fermer la pop-up. Le son sert à faire venir ; une fois qu'on
  est là, il n'est plus que du bruit. L'attente, elle, ne se lève toujours que
  sur une vraie réponse.
- **La carte propose « Faire l'exercice »** — la pop-up pouvait être fermée, et
  la carte d'accueil restait alors le seul endroit à dire qu'un exercice était
  dû, sans offrir aucun moyen de le faire.

- **Chaque fiche d'exercice renvoie aux articles qui la justifient** — champ
  `articles` sur l'exercice, attribué par sujet plutôt qu'en masse : un exercice
  qui renvoie à tout ne renvoie à rien. `content.test.ts` vérifie que chaque
  lien pointe vers un article existant et qu'aucune fiche ne se termine sur une
  section vide.
- **Cinq articles issus d'une recherche de littérature** — lumière du jour
  (solide), verres anti-lumière bleue (non démontrée, Cochrane 2023 : 17 essais,
  619 participants, aucun effet), tri des interventions au bureau (partielle),
  expiration allongée (partielle), open space (partielle). Gradués selon la même
  échelle que les six premiers, et chacun se termine sur ses propres limites.
- **Une affirmation corrigée dans mes propres fiches** — j'avais écrit qu'une
  expiration plus longue « active naturellement le système qui calme ». Un essai
  randomisé de 2023 (Vanderbilt, 100 participants, 12 semaines) trouve que la
  respiration lente réduit bien le stress, mais qu'allonger l'expiration
  n'apporte aucun avantage mesurable par rapport à des durées égales. La fiche
  dit désormais ce qui est démontré — ralentir — et ce qui ne l'est pas.

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
