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

- **Bureau ou maison : on filtre les mouvements, pas les routines** — huit des
  42 exercices ne se font pas en open space (fente, cercles de bras, étirement à
  l'encadrement de porte…), et chacun porte un `discreet`. Au bureau, une
  routine est servie sans ses mouvements peu discrets, positions renumérotées et
  durée recalculée. Écarter la routine entière aurait été plus simple mais
  absurde : « Nuque & trapèzes » est exactement ce qu'il faut au bureau et ne
  contenait qu'un seul étirement à la porte.
- **Sauf quand rogner reviendrait à la vider** — en dessous de la moitié des
  étapes conservées, la routine est laissée entière et signalée « plutôt à la
  maison ». « Réveil » ne garde que deux mouvements sur neuf : servir cinq
  minutes de réveil en quarante secondes serait pire qu'un badge honnête. Les
  routines concernées restent visibles, on peut être chez soi demain.
- **Rien ne disparaît en silence** — la fiche de routine dit combien de
  mouvements sont masqués et pourquoi, et `hiddenAtOffice` compte à partir de ce
  qui a réellement été retiré, jamais de ce qui aurait pu l'être.
- **Les routines composées par l'utilisateur ne sont pas adaptées** — il a choisi
  ses mouvements ; les lui retirer en silence serait pire que de les proposer au
  mauvais endroit.
- **L'adaptation est calculée dans le store, jamais dans un sélecteur** —
  `adaptToPlace` construit un nouvel objet quand il rogne, et un sélecteur
  zustand qui renvoie une identité neuve à chaque rendu part en boucle infinie.
  Ça a réellement fait planter l'écran de routine avant d'être corrigé ; la
  frontière d'erreur ajoutée plus tôt a transformé la boucle en écran de secours
  plutôt qu'en page noire.

- **« Démarrage auto » invite, il ne démarre pas** — le réglage existait,
  s'enregistrait, se synchronisait, et **aucune ligne hors de l'écran de
  réglages ne lisait `autoStartAt`** : régler 09:00 ne déclenchait rien. Ce qui
  l'implémente est une notification unique à l'heure dite, les jours actifs,
  dont la première action démarre la journée — pas un démarrage silencieux. Une
  session ouverte sans toi mesurerait une assise que tu n'as pas faite, et la
  seule chose qui rende la plus longue assise, le taux de réponse et la série
  dignes d'être affichés, c'est qu'aucun des trois n'est inventé. Une seule
  invitation est armée à la fois, sous un id réservé (`AUTO_START_ID`) que
  `cancelAll()` épargne : la fin d'une journée ne doit pas emporter le matin
  suivant. Elle se réarme au premier plan, au changement de réglage et à la fin
  d'une session. Limite assumée, la même que pour tout le moteur : l'app ne
  tourne pas en arrière-plan, donc une semaine sans ouvrir l'app laisse
  l'invitation déjà armée, pas sept.
- **La journée se termine toute seule, à une limite que l'utilisateur a posée**
  — rien ne fermait une session hors du bouton « Terminer » et de l'action de
  notification : une journée oubliée le vendredi soir tournait tout le week-end,
  et la plus longue assise affichait soixante heures parce que c'est
  littéralement ce qui s'était passé du point de vue de l'app. `dayEndAt()`
  prend la première des deux bornes : le début de la plage silencieuse — l'heure
  où l'utilisateur a lui-même dit qu'aucun rappel ne devait tomber — et la fin
  du jour. Ni l'une ni l'autre n'est une supposition sur l'heure à laquelle il a
  quitté son bureau ; ce sont des lignes qu'il a tracées. La borne est appliquée
  à chaque regard sur l'horloge (`catchUp`, et le tic de l'onglet), pas par une
  alarme : Android ne réveille pas l'app pour exécuter du JavaScript.
- **Passé minuit, on demande au lieu de deviner** — fermer à la borne le jour
  même, c'est répéter la règle de l'utilisateur ; le faire le lendemain matin,
  ce serait écrire une heure qu'on ne connaît pas. Une session qui a survécu à
  son jour devient donc un `pendingClose` — la session locale est close
  immédiatement, mais l'heure de fin reste due — et une pop-up demande « tu as
  fini vers quelle heure ? », la proposition de l'app déjà dans la case. Elle se
  ferme sans répondre et revient au premier plan suivant, exactement comme la
  pop-up d'exercice. La réponse est bornée des deux côtés (jamais avant le
  début, jamais après la borne) et vit sous sa propre clé de stockage : elle
  survit à la session qu'elle décrit.
- **Une première ouverture, qui n'existait pas** — `grep -rn "onboarding"` ne
  renvoyait rien : la première ouverture était un formulaire de connexion avec
  code d'invitation, puis un écran avec un bouton. Quatre écrans avant les
  onglets : ce que fait l'app et ce qu'elle ne mesure pas, l'ouverture de
  « Pourquoi trente minutes » **lue depuis le store de contenu** (une correction
  de l'article atteint donc l'accueil, les deux ne peuvent pas diverger), les
  quatre autorisations Android, et le lieu de travail. Le drapeau est local à
  l'appareil et non dans `Settings`, que `/api/me` remplace en entier : un
  second téléphone refait l'introduction, ce qui est juste. La liste des
  autorisations est désormais un composant partagé (`PermissionsList`) entre la
  fiche d'avant-session et l'accueil, pour que les deux ne racontent jamais deux
  histoires des mêmes quatre interrupteurs.
- **`pnpm typecheck` ne vérifiait rien** — `tsconfig.json` a `"files": []` et
  deux `references`, et `tsc --noEmit` sur un fichier de références sans
  `composite` ne compile aucun projet : la commande sortait en 0 sur `src/`
  jamais lu. La CI était donc verte sur trois erreurs de type réelles, dont
  `armFrom(session.id, now)` dans `resumeWork` — l'horloge passée à la place des
  ancrages, deux arguments sur trois — qui lançait un `TypeError` dans
  `planNext` dès qu'une reprise de pause tombait dans une plage calme ou un jour
  exclu. Le script cible maintenant les deux projets explicitement, et `build`
  l'appelle au lieu de refaire le même `tsc --noEmit` inerte.

## Adoption — ce que les forums reprochent à ce genre d'app

Cinq changements dictés par une revue de ce que les gens disent des rappels de
pause : ce qui les fait désinstaller, et ce qui les fait rester. Les sources
sont dans le rapport de session ; ce qui suit, c'est ce qu'on en a fait.

- **L'exercice dû se périme au bout d'un intervalle** — le reproche numéro un
  fait à ce genre d'app est le rappel qui tombe pendant une réunion, et
  l'app qui insiste ensuite. Log Off y était plus exposée que les autres : un
  rappel sans réponse gelait **tout** (rien d'autre n'était armé) et
  ré-ouvrait sa pop-up à chaque passage au premier plan. Ignorer un rappel à
  14 h coûtait donc l'après-midi entière. La dette reste — c'est ce qui rend
  un rappel manqué impossible à contourner en fermant l'app — mais elle
  s'éteint au bout d'un intervalle : le manqué est consigné (`expired`), il
  compte contre le taux de réponse, et la journée repart. Un `awaiting` créé
  par un tap sur la notification est marqué `logged: false` et n'était jusque-là
  jamais consigné du tout : sa péremption écrit désormais le manqué.
- **« Je suis en réunion » sur la pop-up** — « +10 min » n'est pas la bonne
  durée pour une réunion, et fermer la pop-up ne disait rien à l'app. Le
  bouton réutilise la pause manuelle, déjà construite et déjà juste : l'horloge
  gèle, l'exercice reste dû, et les deux reviennent quand on se rassoit.
- **La série ne casse plus tous les samedis** — `computeStreak` remontait les
  jours un par un et s'arrêtait au premier jour sous le seuil. Avec des jours
  actifs du lundi au vendredi, le samedi remettait donc le compteur à zéro
  **chaque semaine** : la série affichée ne pouvait structurellement pas
  dépasser cinq, et valait 1 ou 2 la plupart du temps. Les jours que
  l'utilisateur n'a pas cochés sont maintenant sautés, ni comptés ni
  bloquants. Un seul jour travaillé manqué est par ailleurs pardonné (le
  deuxième arrête la série) : la littérature sur l'abandon est unanime sur le
  fait que le jour où une longue série casse est le jour où l'app est
  supprimée. Le jour pardonné **n'est pas compté** — le nombre reste
  exactement « les jours où tu as bougé », l'app ne le gonfle pas.
  `/api/stats` lit désormais `settings.weekdays` pour ça.
- **On peut se servir de l'app sans compte** — forcer la création d'un compte
  avant d'avoir prouvé quoi que ce soit est l'erreur d'accueil la plus chère
  qui existe, et ici elle était doublée d'un code d'invitation et d'une base
  Neon en veille : téléphone neuf, serveur endormi, l'app ne s'ouvrait pas du
  tout. Or tout ce qui compte était déjà local — le contenu est embarqué, la
  copie des réglages sur l'appareil est ce que lit le moteur de rappels. Il ne
  manquait que les chiffres. L'écran de connexion mène donc par un bouton
  « Commencer » ; le compte est une case en dessous, et ne sert qu'à
  synchroniser deux appareils. `NoAccountError` (statut 0, donc lu comme
  « hors ligne » par tous les appels déjà écrits pour l'être) coupe court à
  toute requête quand il n'y a pas de jeton : sans ça, un appareil sans compte
  déclenchait la danse du refresh puis l'écouteur `authLost`, et renvoyait vers
  la connexion quelqu'un qui n'en voulait pas.
- **Le suivi se calcule sur l'appareil** — la file d'événements est un tampon de
  synchronisation : un flush réussi la vide, ce qui est correct pour un tampon
  et inutilisable comme archive. Les mêmes entrées sont donc aussi écrites dans
  un **journal** gardé 45 jours, et `buildLocalStats` applique dessus exactement
  les mêmes règles pures que le serveur. L'écran Suivi s'affiche donc avant
  toute requête, s'affiche hors ligne, et s'affiche pour qui n'a pas de compte.
  La copie serveur reprend la main dès qu'elle arrive : elle a tout l'historique,
  le journal n'en a que six semaines.
- **Les alarmes de réveil d'écran survivent au redémarrage** — Android vide les
  alarmes en attente à chaque redémarrage. Les notifications, elles, revenaient
  (le plugin déclare son propre récepteur de démarrage) ; l'alarme qui rallume
  l'écran, non — jusqu'à la prochaine ouverture manuelle. Le plugin ne stockait
  qu'un ensemble d'ids, de quoi annuler mais pas de quoi reconstruire. Il garde
  maintenant la charge utile complète, et `BootReceiver` la rejoue
  (`BOOT_COMPLETED`, `QUICKBOOT_POWERON`, `MY_PACKAGE_REPLACED`), tout enveloppé
  dans un try/catch : un récepteur qui lève au démarrage affiche un plantage à
  l'utilisateur, ce qui serait un bien pire marché qu'un réveil d'écran manqué.
  Coque `1.3.0` / `versionCode 4` — ça ne peut pas descendre par OTA.
  **Non vérifié à l'exécution** : pas de SDK Android dans l'environnement de
  développement distant, seul `apk.yml` compilera ce code.

## Fluidité et écriture

- **La feuille modale n'avait pas de hauteur** — le sélecteur d'exercices
  contient 42 entrées, la feuille grandissait avec, et comme elle est ancrée en
  bas d'un conteneur fixe, le débordement partait par le haut sans rien à faire
  défiler : les dernières entrées étaient littéralement inatteignables. Mesuré
  après correction : 656 px visibles pour 4 128 px de contenu. La feuille est
  désormais bornée à 86 vh avec un corps défilant, et le glisser-pour-fermer a
  été déplacé sur la poignée : sur un corps défilant, les deux gestes étaient le
  même geste, et faire défiler la liste refermait la feuille.
- **Le compositeur de routine répond à l'instant** — chaque appui écrivait dans
  le stockage de l'appareil puis reconstruisait toutes les routines avant que
  quoi que ce soit ne bouge à l'écran. Sur un bouton qu'on presse dix fois de
  suite, ça se voit. L'écran tient maintenant sa propre copie de la liste, la
  dessine, et enregistre derrière (`setCustomSteps` écrit la liste entière
  plutôt qu'une mutation à la fois). Mesuré : dix appuis en 339 ms, aucun perdu.
  Un champ de recherche a été ajouté au sélecteur, parce que 42 entrées ne se
  parcourent pas quand on sait déjà ce qu'on cherche.
- **Chaque page s'ouvre en haut** — le défilement vit sur le `<main>` de
  `AppLayout` et React Router n'y touche pas, donc ouvrir une fiche depuis le
  bas de la bibliothèque atterrissait au milieu de l'explication. Remis à zéro
  en `useLayoutEffect` sur le changement de route, donc avant peinture. Même
  chose entre les écrans de l'accueil. **Sans effet tant que `#root` n'était pas
  borné** : voir l'entrée suivante, écrite après coup.
- **`#root` avait une hauteur minimale, pas une hauteur** — `min-height: 100dvh`
  laissait la colonne grandir avec son contenu, donc le `flex-1 min-h-0
  overflow-y-auto` de `<main>` ne recevait jamais de hauteur bornée et ne
  devenait jamais un conteneur défilant : c'était le document qui défilait.
  Mesuré sur la bibliothèque en 390x844 : `main` faisait 3 196 px de haut pour
  autant de contenu, `scrollTop` restait à zéro par construction, et
  `document.scrollingElement` montait à 3 252. Deux conséquences que je n'avais
  pas vues en écrivant la remise à zéro du défilement : elle remettait à zéro
  une valeur qui valait déjà zéro, donc elle ne faisait rien ; et une feuille
  modale ne pouvait pas contenir son propre défilement de façon fiable, le
  document restant défilable dessous. `#root` a maintenant `height` et
  `max-height` à `100dvh` avec `overflow: hidden`.
- **L'écran de connexion défile** — corollaire du précédent. Une fois `#root`
  borné, le formulaire d'inscription complet (nom, e-mail, mot de passe, code
  d'invitation) dépassait un écran de 360x640 de cinq pixels et n'était plus
  rattrapable, là où le document le rattrapait avant. Il est devenu un conteneur
  défilant, et le bloc est centré par `my-auto` plutôt que par
  `justify-center` sur le parent : un conteneur flex qui centre son enfant
  rogne le haut de celui qui déborde.
- **Le défilement tactile ne se vérifie pas au script** — la première
  vérification de la feuille modale appelait `scrollTo()` puis constatait que
  `scrollTop` avait bougé, ce qui ne prouve que la validité du CSS. Un vrai
  doigt passe par le compositeur, respecte `touch-action` et les gestionnaires
  d'événements. Les tests de geste passent désormais par
  `Input.dispatchTouchEvent` (démarrage, une douzaine de déplacements, fin), et
  la méthode est elle-même validée sur un cas témoin avant d'être appliquée à
  l'app. `Input.synthesizeScrollGesture` en mode tactile a été essayé et écarté :
  il ne pilote pas les conteneurs défilants imbriqués dans cet environnement, et
  faisait passer pour cassé ce qui fonctionnait.
- **Le tiret cadratin ne sert plus d'incise** — c'est la marque la plus
  reconnaissable d'un texte écrit par une machine, et il y en avait partout :
  accueil, réglages, pop-up de fin de journée, bibliothèque, suivi, plus 24
  occurrences dans le contenu embarqué. Réécrits en deux-points, en virgules ou
  en phrases séparées, sans toucher à un seul chiffre ni à une seule nuance de
  preuve. Deux exceptions gardées : le tiret comme valeur vide (« — » quand il
  n'y a rien à afficher) et dans un intitulé de source (« INRS — Travail sur
  écran »). Les noms d'étapes gauche/droite passent en parenthèses
  (« Fente basse (droite) »).

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
