# Pivot — Log Off, coach douleur & posture adaptatif

Document de spécification et de passation. Il décrit le nouveau positionnement,
ce qui change dans le modèle de données, la logique exacte du plan adaptatif,
les écrans refaits, et la justification de chaque choix par rapport à la
doctrine de `BRIEF-CONTENU.md` — qui reste en vigueur, entière.

---

## 1. Le positionnement

> Pour les personnes qui travaillent assises et souffrent déjà de nuque, dos,
> épaules ou poignets, Log Off est le coach quotidien ultra-court qui **structure
> ta journée de travail** et réduit réellement la douleur perçue grâce à un plan
> adaptatif de mobilité + renforcement léger, tout en restant radicalement
> honnête sur les preuves.

**Modèle économique cible.** B2C freemium / abonnement, B2B possible plus tard.
La valeur doit tenir une rétention D30 ≥ 35 % sur la cohorte « douleur ≥ 3/10 ».

### La boucle : Timer × Plan

Le moteur de session de travail est **gardé**. Ce qui change est le contenu de
la pause, et ce que le rappel ouvre.

1. La personne démarre sa journée (ou le démarrage automatique la lance).
2. À l'intervalle réglé — 30 par défaut, 45 et 60 offerts — un rappel arrive.
3. **Le premier rappel qui trouve le plan du jour non fait ouvre le plan**
   (4 à 8 min). Les suivants ouvrent la pause courte de trois minutes.
4. À la fin : « Comment est ta nuque maintenant ? », 0-10.
5. Le plan est recomposé, la heatmap bouge.
6. Rappel raté → **pas de gel de journée**, un snooze qui recule.

#### Pourquoi « le premier rappel », et pas tous

C'est le seul point du cahier des charges qui ne se résolvait pas tout seul.
« Un rappel toutes les trente minutes » et « le rappel ouvre le plan de 4 à 8
minutes » donnent ensemble jusqu'à **seize minutes d'exercice par heure**.
Personne ne fait ça, et une app qui le propose est désinstallée le deuxième jour.

La règle retenue : **le plan est la dose du jour, le timer est la structure de la
journée.** Le plan est servi par le premier rappel qui le trouve non fait ;
ensuite les rappels redeviennent ce qu'ils ont toujours été, une pause de trois
minutes pour se lever. Les deux objets gardent leur raison d'être et ne se
concurrencent pas.

Le drapeau qui décide est `usePlanStore().doneToday`, dérivé du **journal des
séances terminées** — pas d'un booléen que l'app met quand elle pense que tu l'as
sans doute faite. Il retombe à faux au changement de jour, puisqu'il est calculé
sur la date locale.

L'autre lecture possible — découper le plan en tranches servies à chaque rappel —
a été écartée : elle casse la question de fin de séance, qui a besoin d'un corps
qui vient de finir de bouger, et elle rend le delta de douleur inexploitable.

#### Le rappel raté ne gèle plus la journée

Avant : un rappel sans réponse n'armait **rien d'autre** jusqu'à ce qu'un
intervalle complet passe. Ignorer un prompt pendant une réunion coûtait
l'après-midi. C'est, mot pour mot, la raison que les gens donnent pour supprimer
ce genre d'app.

Maintenant (`backoffMinutes`, `armBackoff`) :

| Ratés d'affilée | Prochain rappel |
|---|---|
| 1 | dans 10 min |
| 2 | dans 20 min |
| 3 et plus | à la cadence normale, plus de relance |

Jamais plus long que l'intervalle choisi — quelqu'un réglé sur quinze minutes a
demandé quinze minutes, et un backoff qui le dépasserait serait l'app qui passe
outre le réglage. Jamais dans une plage silencieuse ni un jour non travaillé :
la grille ordinaire reprend la main dans ces cas-là, un snooze n'est pas un moyen
de contourner les heures qu'on a fermées.

**Le troisième raté est une information**, pas une raison d'insister : ce n'est
pas le bon moment, ou pas le bon jour. La bonne réponse est d'arrêter de demander
autrement. La dette (`awaiting`) reste posée, reste visible dans le prompt, et
reste au journal — ce qui disparaît est seulement le gel.

Le compteur est **persisté** : un redémarrage d'app au milieu d'un backoff ne
doit pas le remettre à dix minutes, sinon l'app relance précisément là où elle a
promis de reculer.

### Ce qui change vraiment

L'app comptait ce qu'elle avait provoqué : des levers, des minutes, un taux de
réponse. Aucun de ces chiffres ne répond à la seule question qu'a quelqu'un qui
a mal à la nuque. Le pivot ajoute **une mesure de résultat, donnée par
l'utilisateur**, et fait dépendre la séance du lendemain de cette réponse.

| Avant | Après |
|---|---|
| Un minuteur toutes les 30 min | Le même minuteur, dont le premier rappel du jour ouvre le plan |
| Une routine fixe par zone | Une séance recomposée chaque jour depuis le catalogue |
| Mobilité seule | Mobilité + renforcement, dosé sur la douleur déclarée |
| On compte les levers | On compte les levers **et** ce que la personne répond |
| Un rappel raté gelait la journée | Snooze qui recule : 10 min, 20 min, puis on arrête |
| Accueil = carte de session | Accueil = plan du jour + heatmap de douleur |

### Ce qui ne change pas — la doctrine

Rien n'a été assoupli. Concrètement, dans ce pivot :

- **Aucun chiffre inventé.** Le seul nombre nouveau affiché par l'app est la
  réponse 0-10 que la personne a tapée, et les moyennes journalières de ces
  réponses. Pas de score de progression, pas d'indice de posture, pas de
  bénéfice estimé. Un jour sans réponse est une **case vide** dans la heatmap,
  jamais un zéro (`painStats.heatmap`, `PainHeatmap.tsx`).
- **Niveau de preuve porté.** Le renforcement entre dans l'app avec son article,
  `renforcement-et-douleur`, en niveau `partielle` — parce que la revue Cochrane
  qui le soutient conclut elle-même qu'il n'existe toujours pas de preuve de
  haute qualité.
- **L'app le fait contre elle-même.** L'article dit que la revue **ne mesure pas
  la posture**, alors que le mot est dans le positionnement produit. Il dit que
  les essais portent sur des programmes supervisés de plusieurs semaines et pas
  sur six minutes derrière un bureau, et que l'écart joue probablement contre
  l'app.
- **Ni félicitations ni reproche.** L'écran de fin dit « Terminé. » puis pose sa
  question. Le plan dit « Nuque à 7/10 : mobilité seule aujourd'hui. » Un test
  interdit à la phrase du plan de contenir « bravo », « félicit », « excellent »
  ou « progrès » (`compose.test.ts`).
- **Pas de prétention médicale.** L'accueil du premier lancement porte la phrase
  du pied de profil, et répondre « plus de six mois » déclenche une ligne qui
  renvoie explicitement au kiné ou au médecin.
- **Charger ce qui fait très mal n'est pas documenté**, donc l'app ne le fait
  pas : à 6/10 et au-dessus, zéro mouvement de renforcement, quelle que soit la
  tendance (`strengthSlots`).

---

## 2. Le modèle de données

### 2.1 Ce qui a été ajouté

**`exercises.json` — `type: "mobility" | "strength" | "reset"`**
Les 42 mouvements existants sont classés : six `reset` (respiration, paumes,
clignement, regard au loin, loin-près, s'installer), le reste `mobility`. Les 14
nouveaux sont `strength`.

**`routines.json` — `goal` et `targetZones`**
`goal: "pain_relief" | "prevention" | "strength"`.
`targetZones: Zone[]`, qui n'est **pas** la zone de rangement : « Debout » est
classée sous `bureau` et travaille `["hanches", "dos", "chevilles"]`. C'est
`targetZones` que le compositeur lit, et c'est ce qui permet à une routine
« bureau » d'alimenter le pool d'une zone douloureuse.

**Nouveau : le journal de douleur** (`features/plan/pain.ts`)
Une ligne par réponse 0-10 : instant, date locale, zone, score, origine
(`onboarding` / `post-session` / `manual`), routine éventuelle. Stocké sur
l'appareil, comme le journal d'activité et pour les mêmes raisons : l'écran doit
se dessiner hors ligne, et pour quelqu'un sans compte c'est tout le dossier.
Délibérément **hors** des préférences synchronisées : `/api/prefs` remplace son
objet en bloc, et un historique de douleur n'est pas un réglage.

**Nouveau : le profil douleur** (`features/plan/profile.ts`)
Ce que le premier lancement a collecté : zones, baseline par zone, depuis quand,
minutes par jour.

**Base.** `db/004_adaptive.sql` ajoute `exercises.type`, `routines.goal`,
`routines.target_zones` et la table `pain_entries`. `scripts/gen-seed.ts` écrit
les trois colonnes ; `db/002_seed_content.sql` reste **généré**, jamais édité.
`/api/routines` et `/api/exercises` renvoient les nouveaux champs, sinon la
copie base perdrait le typage et le plan composerait à l'aveugle.

### 2.2 Les zones — ce qui n'a pas été ajouté

Le positionnement parle d'épaules. **Aucune zone n'a été créée.**
`BRIEF-CONTENU §3.4` fait d'un ajout de zone une modification du type `Zone`, de
la liste `ZONES`, de la carte d'accueil et du schéma SQL, et les mouvements
d'épaule vivent déjà sous `nuque` et `dos` — où quelqu'un qui a mal à l'épaule
regarde d'abord.

`PAIN_ZONES` est **dérivé** : la famille `corps`, soit nuque, dos, lombaires,
hanches, poignets, chevilles. `matin` et `bureau` sont des moments, `yeux` et
`bien-etre` ne sont pas des parties du corps qu'on note sur dix.

### 2.3 Le lieu de travail : deux valeurs devenues trois

`Place` passe de `bureau | maison` à `bureau | open-space | maison`, avec un
niveau de discrétion dérivé :

| Lieu | Discrétion | Effet sur le plan |
|---|---|---|
| `maison` | `none` | rien n'est filtré |
| `bureau` | `moderate` | les mouvements `discreet: false` sont écartés, sauf si une zone n'a plus rien à proposer |
| `open-space` | `strict` | filtre dur, jamais de repli sur un mouvement voyant |

La règle sur les routines livrées (`adaptToPlace`, seuil `MIN_KEPT`) est
inchangée pour les deux lieux de bureau.

---

## 3. Le contenu produit

### 3.1 Quatorze mouvements de renforcement

Tous réutilisent une figure déjà dessinée — un dessin neuf n'est pas du travail
de contenu (`BRIEF-CONTENU §6.2`). Les quatre clés libres sont dépensées sur les
quatre mouvements que leur dessin représente réellement.

| Clé | Zone | Figure | Discret |
|---|---|---|---|
| `isometrie-nuque-avant` | nuque | `menton-rentre` | oui |
| `isometrie-nuque-laterale` | nuque | `nuque-laterale` | oui |
| `isometrie-nuque-arriere` | nuque | `nuque-flexion` | oui |
| `omoplates-tenu` | haut du dos | `omoplates-b` *(libre)* | oui |
| `tirage-isometrique-chaise` | haut du dos | `tirage-vide` | oui |
| `rotation-externe-tenue` | épaules | `rotation-externe` | oui |
| `elevation-y` | épaules | `cercle-bras` | non |
| `pompe-bureau` | épaules / pectoraux | `encadrement-porte` | non |
| `gainage-assis` | tronc | `bascule-bassin` | oui |
| `charniere-hanche` | lombaires / fessiers | `chat-vache-b` *(libre)* | non |
| `assis-debout` | jambes / fessiers | `extension-chaise` | non |
| `poing-serre` | main | `doigts-poing` *(libre)* | oui |
| `poignet-resiste` | poignet | `poignet-extension` | oui |
| `mollet-excentrique` | mollets | `mollet-plat` *(libre)* | oui |

Dix sur quatorze sont discrets, ce qui est la condition pour que le plan tienne
en open space, qui est le contexte principal.

Chacun porte un `easier`, un `avoid` **réel** — un test refuse « Rien de
spécifique. » sur un mouvement de renforcement, parce que charger une zone qui
fait déjà mal est le seul endroit où cette réponse n'est pas acceptable — au
moins un muscle et au moins un article.

**Dessins à demander plus tard** (aucun ne bloque) : une pompe inclinée sur le
bureau, une élévation en Y, un lever de chaise, une isométrie de nuque main sur
le front. Les figures actuelles sont proches mais pas exactes ; le pas-à-pas de
la fiche dit précisément quoi faire.

### 3.2 Seize routines

Deux par zone douloureuse — une courte de 60 à 90 s, une de 4 à 6 min — plus
quatre routines `strength` dédiées.

| Slug | Zone | Durée | Goal |
|---|---|---|---|
| `nuque-flash` / `nuque-soulagement` | nuque | 90 s / 5 min | pain_relief |
| `dos-flash` / `dos-soulagement` | dos | 90 s / 5 min | pain_relief |
| `lombaires-flash` / `lombaires-soulagement` | lombaires | 90 s / 5 min | pain_relief |
| `hanches-flash` / `hanches-soulagement` | hanches | 90 s / 5 min | pain_relief |
| `poignets-flash` / `poignets-soulagement` | poignets | 60 s / 4 min | pain_relief |
| `chevilles-flash` / `chevilles-circulation` | chevilles | 90 s / 4 min | pain_relief |
| `renfort-nuque` | nuque | 3 min | strength |
| `renfort-haut-du-dos` | dos | 4 min 30 | strength |
| `renfort-tronc` | lombaires | 4 min | strength |
| `renfort-poignets` | poignets | 2 min 30 | strength |

**Les 13 routines existantes ne sont pas touchées** : aucun slug renommé, aucune
étape déplacée. Elles reçoivent seulement leur `goal` et leurs `targetZones`.
Les slugs câblés (`debout`, `hanches`, `yeux`, `respiration`, `reveil`, `nuque`,
`express`, `bureau-complet`, `dos`, `poignets`, `chevilles`, `lombaires`) sont
intacts, donc `kinds.ts` et `daypart.ts` continuent de tomber juste.

Les 16 nouvelles survivent toutes au filtre bureau — vérifié à la composition,
la moins discrète (`hanches-soulagement`) garde 7 étapes sur 10.

### 3.3 Un article

`renforcement-et-douleur`, tag `pratique`, niveau **`partielle`**, source
primaire : Gross et al., *Exercises for mechanical neck disorders*, Cochrane
Database of Systematic Reviews, 2015.

Chiffres cités, tous issus du résumé de la revue : 27 essais, 2 485 participants
analysés sur 3 005 randomisés ; renforcement cervico-scapulo-thoracique et
membre supérieur sur cervicalgie chronique, SMD groupé **-0,71** (IC 95 %
-1,33 à -0,10), qualité **modérée** ; programmes combinés renforcement +
étirements, **-0,33** (IC -0,55 à -0,10) sur la douleur et **-0,45** (IC -0,72
à -0,18) sur la fonction ; **aucune preuve** sur la cervicalgie aiguë.

L'article contient les six éléments de structure attendus, une `::figure`, et sa
section obligatoire **« Ce qu'il faut garder en tête »**. Il dit quatre limites,
dont deux jouent contre l'app.

L'article est rattaché aux 14 nouveaux mouvements **et** à cinq anciens
(`omoplates`, `tirage-vide`, `rotation-externe`, `mollet-releve`,
`bascule-bassin`) — mission 6 du brief, orphelins rattachés sans recherche
nouvelle.

---

## 4. La logique du plan adaptatif

Tout est dans `src/features/plan/compose.ts`. La fonction est **pure** : chaque
entrée est un argument, donc deux appareils avec le même historique proposent la
même séance, et « pourquoi ce mouvement » a une réponse.

### 4.1 Entrées

`today`, le profil, le journal de douleur, le catalogue de routines, le
catalogue de mouvements, le lieu.

### 4.2 Étape 1 — classer les zones

`currentScore(zone)` = la **dernière réponse** pour cette zone, sinon la valeur
déclarée au premier lancement, sinon `null`.

Les zones connues sont l'union de celles déclarées et de **toutes celles jamais
notées** : quelqu'un qui a répondu une fois sur ses poignets a dit quelque chose,
et l'ignorer parce que ce n'était pas dans le questionnaire d'ouverture serait
une façon de ne pas écouter.

Tri décroissant, égalité tranchée par l'ordre de `PAIN_ZONES` — donc stable.
Rien de connu → `["nuque", "dos", "lombaires"]`, les trois zones dont l'app a
des articles ; ce n'est pas une supposition sur la personne, et la phrase de la
carte le dit.

`primary` = première, `secondary` = deuxième. Jamais plus de deux : six minutes
réparties sur trois zones ne font rien à aucune des trois.

### 4.3 Étape 2 — doser le renforcement

```
strengthSlots(score, tendance, minutes) :
  si score ≥ 6            → 0        ← aucune preuve sur la douleur aiguë
  slots = (score = null ou score < 3) ? 1 : 0
  si tendance ≤ -1        → slots + 1
  plafond = minutes ≥ 6 ? 2 : 1
  retourne min(slots, plafond)
```

`tendance` = moyenne du tiers le plus récent moins moyenne du tiers le plus
ancien, sur 14 jours, en points. **`null` tant qu'il n'y a pas au moins quatre
jours de réponses** — une seule réponse n'est pas une tendance, et le plan reste
alors du côté prudent.

C'est ici que « le plan s'adapte réellement » est vrai ou faux : la seule chose
qui débloque un deuxième mouvement de charge est une **baisse mesurée des
réponses de l'utilisateur**. Rien d'autre : ni l'assiduité, ni le nombre de
séances, ni le temps écoulé.

`planGoal` : `pain_relief` tant que la zone est à 3 ou plus ; sinon `prevention`
à un slot, `strength` à deux.

### 4.4 Étape 3 — construire les pools

Pour chaque zone retenue, tous les mouvements distincts du bon `type` servis par
une routine dont `targetZones` contient la zone, dans l'ordre du catalogue. Le
nom, la consigne, la figure et la durée sont **repris de l'étape existante**, si
bien qu'une séance composée et une routine livrée se lisent pareil.

Filtre de discrétion (§2.3), puis **rotation** du pool par le nombre de jours
depuis la création du profil : deux jours de suite n'ouvrent pas sur le même
mouvement. Déterministe, pas aléatoire — un tirage au sort ne se rejoue pas
quand quelqu'un demande pourquoi il a eu ça.

### 4.5 Étape 4 — remplir le budget

Budget = `minutes × 60`. Dans cet ordre :

1. **Le retour au calme est réservé en premier.** Une séance qui déborde doit
   perdre un étirement, jamais ce qui la termine — c'est aussi ce qui fait que la
   question de fin tombe sur un corps arrêté.
2. **Les blocs de charge**, en alternant les zones, dans la limite des slots.
3. **La mobilité**, en alternant les zones, tant que le bloc suivant tient dans
   ce qui reste. Une zone épuisée est retirée de l'alternance.

Ordre final servi : mobilité → renforcement → retour au calme. C'est l'ordre
qu'un kiné utiliserait : mobiliser avant de charger.

`durationS` est la somme exacte des blocs. Un test le vérifie pour 4, 6 et 8
minutes, et vérifie aussi que le plan **utilise** son budget (à 45 s près) au
lieu de s'arrêter à deux mouvements.

### 4.6 Étape 5 — la phrase

Une ligne, factuelle, qui nomme le nombre utilisé :

- « Nuque à 7/10 : mobilité seule aujourd'hui, aucun mouvement de charge. »
- « Nuque à 2/10, en baisse de 2,5 points sur quinze jours : 2 mouvements de
  renforcement. »
- « Rien de déclaré pour l'instant : séance d'entretien sur les zones les plus
  exposées. »

Elle vient du compositeur, donc la carte d'accueil et la notification ne peuvent
pas donner une raison que le moteur n'a pas utilisée.

### 4.7 Le plan n'est jamais stocké

Il est recomposé à chaque changement d'une de ses entrées — une réponse, un
changement de lieu, un rafraîchissement du catalogue. Le stocker créerait une
deuxième version de la vérité, périmée à minuit. C'est aussi ce qui rend
l'adaptation visible : la carte change à l'écran au moment où la réponse est
donnée.

---

## 5. Le premier lancement

Cible : **premier plan à l'écran en moins de 90 secondes**, mesuré sur
`onboarding_completed.seconds` et sur rien d'autre.

| # | Écran | Contenu |
|---|---|---|
| 1 | Ce que c'est | Trois paragraphes, dont la phrase « pas un dispositif médical » |
| 2 | **Où as-tu mal ?** | Multi-sélection des six zones + une échelle 0-10 par zone choisie |
| 3 | **Depuis combien de temps ?** | 3 choix ; > 6 mois affiche le renvoi au professionnel |
| 4 | **Tu travailles où ?** | bureau / open space / maison, avec la phrase de ce que ça change |
| 5 | **Combien de temps par jour ?** | 4 / 6 / 8 min |
| 6 | **Ton plan** | La carte réelle + « Lancer la séance » |

Détails qui comptent :

- **Rien n'est pré-rempli sur l'échelle.** Un défaut à 5 mettrait un chiffre dans
  la bouche de quelqu'un, et tout nombre affiché par cette app doit être un
  nombre tapé. Le bouton « Suivant » est bloqué tant qu'une zone choisie n'a pas
  son chiffre, et la ligne sous le bouton dit laquelle.
- **Aucune zone n'est obligatoire.** Sans zone, la séance est un entretien, et la
  carte le dit.
- **Les réponses du premier lancement sont des entrées de journal comme les
  autres** (`source: 'onboarding'`), donc le J0 de tout delta est une réponse
  donnée, jamais une baseline attribuée par l'app.
- **L'écran des autorisations Android a été retiré du premier lancement.** Il
  mettait quatre boîtes de dialogue système entre l'ouverture et la première
  séance, pour protéger des rappels qui ne comptent qu'à partir du deuxième jour.
  L'accueil ouvre toujours la même feuille (`PermissionsSheet`) dès qu'une
  session a besoin d'une autorisation qui manque — c'est-à-dire au moment où la
  demande a un sens.

---

## 6. Les écrans

### 6.1 Accueil (`Today.tsx`)

De haut en bas :

1. **Plan du jour** — durée, zones ciblées, type de séance, nombre de blocs, le
   nombre de renforts s'il y en a, la phrase du compositeur, et « Lancer la
   séance ».
2. **Ce que tu as répondu** — sélecteur 7 / 14 / 30 jours ; la ligne de delta
   « Nuque : 6 → 3 en 11 jours » ; la heatmap.
3. **Ta journée** — la carte de session, qui existe toujours : le moteur de
   rappels de lever n'a pas été retiré, il est passé au deuxième rang.
4. **Routines libres** — la recherche et les cartes de zones, inchangées.
5. Les lignes comptées : « 3 levers sur 6 rappels », la série et les jours de
   battement restants.

La ligne de delta n'apparaît qu'avec des réponses sur **deux jours différents**.
Sinon : « Deux réponses sur deux jours différents, et cette ligne dira ce qui a
changé. » — ce qui est une information, pas une exhortation.

### 6.2 Heatmap (`PainHeatmap.tsx`)

Une ligne par zone réellement notée — jamais une ligne pour une zone que
personne n'a mentionnée. Une case par jour. **Un jour sans réponse est un
contour vide**, jamais une couleur : l'app ne peut pas savoir qu'un jour sans
réponse était un bon jour.

L'échelle est un dégradé continu accent → danger, pas un feu tricolore : il n'y
a pas de seuil à partir duquel une réponse devient une mauvaise réponse.

### 6.3 Lecteur (`Player.tsx`)

`/player/plan` joue la séance composée ; les autres slugs jouent le catalogue.
À la fin : « Terminé. », la durée, puis **« Comment est ta nuque maintenant ? »**
avec l'échelle 0-10. Le bouton « Retour » est désactivé tant qu'il n'y a pas de
réponse ; « Répondre plus tard » existe et est journalisé (`pain_skipped`), parce
qu'un écran dont on ne peut pas sortir est un écran qu'on tue.

La zone demandée est la zone primaire du plan, ou la première `targetZone`
notable d'une routine libre — et rien n'est demandé pour la respiration ou les
yeux, où il n'y aurait rien d'honnête à demander.

### 6.4 Profil (`Settings.tsx`)

Nouvelle section **« Ton plan »** : minutes par jour, zones suivies (ajouter une
zone ouvre son échelle tout de suite), et la suggestion d'horaires de rappel.
La section « Session » gagne le troisième lieu et la phrase de ce qu'il change.

### 6.5 Rappels contextuels (`features/reminders/contextual.ts`)

Le rappel mobilité disait la même phrase le jour d'un 8 et le jour d'un 1, et
ouvrait « Hanches » dans les deux cas. Il nomme désormais la zone du plan, dit
la durée réelle et ce que la séance contient, et **ouvre le plan**. Sa raison est
la phrase du compositeur.

**Le rappel de lever fait de même** tant que le plan n'est pas fait : c'est le
point où le timer et le plan deviennent un seul produit. Il garde son mot —
« Debout. », se lever est ce à quoi il sert — et son corps dit ce que se lever
va donner. Une fois le plan fait, il retrouve son texte contextuel à l'heure et
rouvre `debout`.

Le rappel des yeux est laissé tel quel : ce n'est pas une zone douloureuse, et
l'habiller comme telle serait faire semblant de savoir.

### 6.6 « Voir les prochains rappels » (`NextReminders.tsx`)

Un seul rappel est armé à la fois (§8.2 du brief), donc la seule chose visible
était « prochain rappel dans 12 min ». Maintenant qu'un rappel peut ouvrir soit
le plan soit la pause courte, cette ambiguïté coûte quelque chose : la feuille
dit ce qui est armé, à quelle heure, et **ce que le tap ouvrira** — en appelant
la même fonction que le planificateur, donc la liste ne peut pas mentir.

Elle dit aussi ce qu'elle ne promet pas : une plage silencieuse, un jour non
travaillé ou une pause peuvent annuler n'importe lequel.

`suggestMobilityTimes` lit le **journal des séances terminées** et propose les
deux demi-heures où la personne bouge réellement. Compté, pas déduit ; rien en
dessous de huit séances ; et **jamais appliqué tout seul** — un rappel qui se
déplace de lui-même est un rappel auquel personne ne se fie.

### 6.6 Série et gels

`computeStreak` passe d'un pardon par série à **deux gels par mois civil**
(`FREEZES_PER_MONTH`). Un pardon unique pour une série d'un an, c'était en
pratique aucun pardon : une grippe au troisième mois coûtait la série, et la
personne qui l'a perdue n'est pas revenue. Un jour gelé n'est **pas compté** : le
nombre reste exactement « les jours où tu as bougé ». `freezesLeft` donne le
reste du mois, affiché sur l'accueil.

---

## 7. Mécanismes de rétention, et où ils sont

| Mécanisme | Où |
|---|---|
| Feedback douleur post-séance + historique visible | `Player.tsx` (fin), `PainHeatmap`, `painStats.delta` |
| Plan qui s'adapte réellement | `compose.ts` — `strengthSlots` lit la tendance des réponses |
| Streak intelligent, 2 gels / mois | `features/session/stats.ts` |
| Sessions ultra-courtes + mode discret | budget 4/6/8 min ; `DISCRETION` par lieu |
| Rappels contextuels | `features/reminders/contextual.ts` |
| Rappel raté sans gel de journée | `backoffMinutes`, `armBackoff` |
| Aucune culpabilité, aucun « Bravo » | vérifié par test sur la phrase du plan ; aucune félicitation dans les écrans |

---

## 8. Ce qui reste à faire

- **Synchroniser le journal de douleur** : la table `pain_entries` existe,
  l'endpoint `/api/pain` n'est pas écrit. L'app fonctionne entièrement sans, sur
  l'appareil.
- **Drainer le journal analytique** : les événements sont écrits localement et
  bornés à 500. Il faut un endpoint, ou un export manuel pour la bêta.
- **Les quatre dessins** listés en §3.1.
- **Le paywall** : rien n'a été construit côté abonnement. La frontière proposée
  est en §5 de `VALIDATION-PIVOT.md`.
