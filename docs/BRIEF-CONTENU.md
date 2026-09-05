# Log Off — brief de contenu

Document de passation. Il décrit à quoi sert l'application, ce qu'elle fait
écran par écran, la forme exacte que doit prendre son contenu, ce qu'elle
contient déjà, et où il manque quelque chose.

Destiné à quelqu'un qui va faire de la **recherche de contenu** : trouver des
sources, écrire des articles, concevoir des mouvements et des routines. Il ne
suppose aucune connaissance du code, mais tout ce qu'il affirme sur l'app est
vérifiable dans le dépôt, et les chemins sont donnés.

---

## 1. À quoi sert l'application

Log Off est une application Android (Capacitor + React) destinée à une personne
qui travaille assise devant un écran toute la journée. Elle fait trois choses :

1. **Elle rappelle de se lever**, à intervalle réglable, trente minutes par
   défaut, pendant une session de travail que l'utilisateur démarre le matin.
2. **Elle montre quoi faire** pendant les deux ou trois minutes de la pause :
   une routine guidée, minutée, illustrée, avec une fiche par mouvement.
3. **Elle compte ce qui s'est réellement passé** : levers, réponses aux
   rappels, minutes bougées. Rien d'estimé, rien d'inventé.

### La doctrine, qui n'est pas négociable

C'est la différence de ce produit, et la contrainte principale sur tout contenu
qu'on lui ajoute.

- **Chaque affirmation porte son niveau de preuve.** Les onze articles sont
  gradués `solide` / `partielle` / `non-demontree`, et le niveau s'affiche sur
  une pastille colorée à côté du titre, dans la liste comme sur l'article.
- **L'app le fait aussi contre elle-même.** Elle propose un rappel pour les
  yeux, et l'article qui l'accompagne explique que la règle 20-20-20 n'a jamais
  été démontrée. Elle mentionne le renforcement musculaire comme
  l'intervention la mieux prouvée du domaine, et précise qu'il n'est pas dans
  l'app.
- **Aucun chiffre inventé.** Pas de calories, pas de « temps assis évité », pas
  de bénéfice santé estimé. Les seuls nombres affichés sont comptés.
- **Chaque article se termine sur ses propres limites.** Taille d'échantillon,
  type de marqueur, ce que l'étude ne dit pas.
- **Le ton est factuel, en tutoiement, sans félicitations ni reproche.** Pas de
  « Bravo ! », pas de « Vous n'avez bougé que 2 fois aujourd'hui ». L'écran de
  suivi affiche « 3 levers sur 6 rappels » et s'arrête là.
- **Pas de prétention médicale.** Le pied de l'écran Profil dit : « Log Off
  n'est pas un dispositif médical. En cas de douleur qui persiste, un médecin
  ou un kiné tranchera mieux qu'une app. » Tout contenu ajouté doit rester
  compatible avec cette phrase.

Conséquence pratique pour la recherche : **une source qui ne permet pas de
dire honnêtement à quel niveau de preuve on se situe n'est pas utilisable.**
Un article de blog santé, un communiqué de presse d'un fabricant de bureaux, ou
une « étude » sans méthode consultable ne suffisent pas.

---

## 2. Ce que fait l'application, écran par écran

Cinq onglets, plus un lecteur et un accueil de première ouverture.

### Aujourd'hui (`src/screens/Today.tsx`)
La carte de session occupe la moitié haute : « Commencer » quand rien ne tourne,
sinon le temps écoulé, un anneau de compte à rebours vers le prochain rappel, et
les boutons Pause / Terminer. En dessous, une carte de conseil qui change selon
l'heure (voir §4), un champ de recherche, et les cartes de zones du corps.

### Routines (`src/screens/Library.tsx`)
Les routines groupées par zone, filtrables, avec une recherche. Chaque routine
ouvre une fiche (titre, durée, résumé, liste des étapes) et chaque étape ouvre
la fiche complète du mouvement. L'utilisateur peut aussi composer ses propres
routines à partir du catalogue des 42 mouvements.

### Infos (`src/screens/Articles.tsx`)
Les articles, avec pastille de niveau de preuve, temps de lecture et
illustration. L'article se lit en markdown assaini, avec ses illustrations
placées dans le fil du texte et un lien vers la source d'origine.

### Suivi (`src/screens/Stats.tsx`)
Levers du jour, barres sur 7 ou 30 jours, série, minutes bougées, taux de
réponse aux rappels sur 30 jours. Calculé sur l'appareil depuis un journal local
de 45 jours ; la copie serveur prend le relais si un compte existe.

### Profil (`src/screens/Settings.tsx`)
Lieu de travail (bureau / maison), intervalle, durée de pause, jours actifs,
plage silencieuse, heure de démarrage automatique, autorisations Android,
rappels des yeux, vibration, alarme sonore, compte, versions.

### Le lecteur (`src/screens/Player.tsx`)
Déroule une routine : un mouvement à l'écran, minuté, avec sa consigne courte,
et sa fiche accessible en feuille. Bips de changement d'étape.

### Le moteur de rappels (`src/stores/session.ts`, `src/features/reminders/`)
Un seul rappel armé à la fois. Trois types : `stand` (se lever), `eyes` (les
yeux, désactivé par défaut), `mobility` (créneaux fixes, 10 h 30 et 15 h 30 par
défaut). Un rappel manqué gèle la journée jusqu'à un intervalle, puis se périme.
La journée se ferme d'elle-même au début de la plage silencieuse ou à la fin du
jour.

---

## 3. Le modèle de contenu

Trois objets, dans `src/content/`, en JSON écrit à la main. Le fichier
`db/002_seed_content.sql` en est **généré** par `pnpm gen:seed` : ne jamais
l'éditer à la main, il serait écrasé.

### 3.1 Routine (`src/content/routines.json`)

```json
{
  "slug": "nuque",
  "title": "Nuque & trapèzes",
  "zone": "nuque",
  "durationS": 210,
  "summary": "Sept mouvements pour la nuque et le haut des épaules.",
  "accent": "sky",
  "sortOrder": 6,
  "steps": [
    {
      "position": 1,
      "name": "Menton rentré",
      "durationS": 30,
      "cue": "Recule le menton, comme pour faire un double menton.",
      "figureKey": "menton-rentre",
      "exerciseKey": "menton-rentre"
    }
  ]
}
```

| Champ | Règle |
|---|---|
| `slug` | unique, minuscules, tirets. **Certains slugs sont câblés dans le code, voir §6.** |
| `zone` | l'une des dix zones existantes exactement (§3.4) |
| `durationS` | doit être **exactement** la somme des `durationS` des étapes |
| `accent` | une des dix clés de couleur : `peach sage navy sky brick lime pine blush sun slate` |
| `steps[].position` | 1..n, sans trou |
| `steps[].name` | le nom affiché ; une variante gauche/droite s'écrit `Fente basse (droite)` |
| `steps[].cue` | une phrase, la consigne lue pendant l'exercice |
| `steps[].figureKey` | doit exister dans `FIGURE_KEYS` (§6.2) |
| `steps[].exerciseKey` | doit exister dans `exercises.json` |

### 3.2 Mouvement (`src/content/exercises.json`)

Objet indexé par clé. Un mouvement est décrit **une seule fois** même s'il
apparaît dans plusieurs routines.

```json
"omoplates": {
  "title": "Serrage d'omoplates",
  "steps": ["Assis ou debout, bras relâchés le long du corps.", "…"],
  "tips": ["Les épaules ne doivent pas monter vers les oreilles…"],
  "easier": "Serre moins fort, l'essentiel est de sentir le haut du dos s'activer.",
  "muscles": ["Rhomboïdes", "Trapèze moyen"],
  "avoid": "Rien de spécifique.",
  "articles": ["muscler-le-haut-du-dos", "ergonomie-ce-qui-marche"],
  "discreet": true
}
```

| Champ | Règle |
|---|---|
| `steps` | le pas à pas numéroté, au moins un |
| `tips` | facultatif, mais c'est là que va la nuance |
| `easier` | **obligatoire, non vide** : une seule façon de rendre le mouvement plus accessible |
| `muscles` | au moins un, affiché en chips |
| `avoid` | **obligatoire, non vide** : le signe qui veut dire « arrête ». `"Rien de spécifique."` est une réponse valide |
| `articles` | **au moins un**, chacun doit exister. C'est ce qui empêche une fiche de finir sur une section vide |
| `discreet` | `false` = ne se fait pas en open space. Voir §6.3, c'est structurant |

### 3.3 Article (`src/content/articles.json`)

```json
{
  "slug": "ce-que-les-pauses-changent",
  "title": "Ce que les pauses changent vraiment",
  "dek": "Elles rechargent, elles ne rendent pas plus performant. La nuance a son importance.",
  "tag": "preuve",
  "evidence": "partielle",
  "readMin": 3,
  "sourceLabel": "« Give me a break! », PLOS One, 2022",
  "sourceUrl": "https://journals.plos.org/plosone/article?id=…",
  "sortOrder": 4,
  "bodyMd": "…"
}
```

| Champ | Règle |
|---|---|
| `tag` | `preuve` \| `reglage` \| `pratique` |
| `evidence` | `solide` \| `partielle` \| `non-demontree` |
| `readMin` | 2 à 4 dans l'existant ; un article plus long ne serait pas lu |
| `sourceLabel` | l'étude ou l'institution, lisible : « Cochrane Database of Systematic Reviews, 2023 » |
| `sourceUrl` | lien direct vers la source primaire, ouvert dans le navigateur système |
| `bodyMd` | markdown. **Doit contenir au moins une illustration** |

**Illustrations dans le corps.** Une ligne à elle seule :

```
::figure omoplates | Le serrage d'omoplates, vu de dos.
```

La clé doit exister dans `FIGURE_KEYS`. C'est un marqueur, pas une image : le
dessin est le même que celui des routines, il suit le thème et ne charge rien.

**Structure attendue d'un article**, telle qu'elle ressort des onze existants :

1. Une phrase d'ouverture qui pose l'enjeu, sans emphase.
2. La méthode de l'étude, avec ses nombres : combien de participants, combien
   de temps, quel type de mesure.
3. Le résultat, avec les chiffres réels et leurs unités.
4. Une illustration.
5. **Ce qu'il faut garder en tête** : les limites, explicitement.
6. Ce que l'app en tire, s'il y a lieu.

### 3.4 Les dix zones (`src/content/index.ts`)

Elles sont groupées en trois familles sur l'accueil.

| Zone | Famille | Étiquette |
|---|---|---|
| `matin` | moment | Matin |
| `bureau` | moment | Au bureau |
| `nuque` | corps | Nuque |
| `dos` | corps | Haut du dos |
| `lombaires` | corps | Lombaires |
| `hanches` | corps | Hanches |
| `poignets` | corps | Poignets |
| `chevilles` | corps | Chevilles |
| `yeux` | bien-être | Yeux |
| `bien-etre` | bien-être | Souffle |

Ajouter une zone est possible mais touche le type `Zone`, la liste `ZONES`, la
carte d'accueil et le schéma SQL. **Le test exige que chaque zone contienne au
moins une routine**, sinon la carte d'accueil mène à une page vide.

---

## 4. Inventaire actuel

### 13 routines

| slug | zone | durée | étapes |
|---|---|---|---|
| `debout` | bureau | 3 min | 6 |
| `express` | bureau | 1 min | 3 |
| `assis` | bureau | 4 min 20 | 7 |
| `bureau-complet` | bureau | 5 min | 7 |
| `reveil` | matin | 5 min | 9 |
| `nuque` | nuque | 3 min 30 | 7 |
| `dos` | dos | 6 min | 9 |
| `lombaires` | lombaires | 5 min | 9 |
| `hanches` | hanches | 4 min | 7 |
| `poignets` | poignets | 2 min 30 | 6 |
| `chevilles` | chevilles | 2 min | 4 |
| `yeux` | yeux | 1 min | 3 |
| `respiration` | bien-etre | 2 min | 3 |

### 42 mouvements

`marche`, `marche-sur-place`, `extension-debout`, `fente-basse`,
`regard-au-loin`, `bascule-bassin`, `menton-rentre`, `nuque-diagonale`,
`rotation-assise`, `ischios-assis`, `figure4-assise`, `calin-bras`,
`triceps-tete`, `cercle-bras`, `chat-vache`, `inclinaison-laterale`,
`respiration-4-6`, `nuque-inclinaison`, `nuque-rotation`,
`haussement-epaules`, `encadrement-porte`, `nuque-flexion`, `omoplates`,
`ouverture-pectorale`, `rotation-externe`, `extension-chaise`, `tirage-vide`,
`genou-poitrine`, `ischios`, `balancement-hanche`, `poignet-flexion`,
`poignet-extension`, `doigts-ecartes`, `mains-dos-a-dos`, `poignet-priere`,
`cheville-cercle`, `talon-pointe`, `mollet-releve`, `clignement`,
`loin-pres-alterne`, `paumes`, `installe-toi`.

Huit sont marqués `discreet: false` : `marche-sur-place`, `fente-basse`,
`cercle-bras`, `chat-vache`, `inclinaison-laterale`, `encadrement-porte`,
`ischios`, `balancement-hanche`.

### 11 articles

| niveau | slug | source |
|---|---|---|
| solide | `pourquoi-30-minutes` | Columbia University Irving Medical Center, 2023 |
| solide | `debout-nest-pas-actif` | University of Sydney / Int. J. Epidemiology, 2024 |
| solide | `muscler-le-haut-du-dos` | J. Orthopaedic & Sports Physical Therapy, 2023 |
| solide | `lumiere-du-jour` | Boubekri et al., J. Clinical Sleep Medicine, 2014 |
| partielle | `ce-que-les-pauses-changent` | « Give me a break! », PLOS One, 2022 |
| partielle | `regler-son-poste` | INRS — Travail sur écran |
| partielle | `ergonomie-ce-qui-marche` | Overview of systematic reviews, Applied Ergonomics, 2019 |
| partielle | `expiration-plus-longue` | Vanderbilt, 2023 |
| partielle | `open-space` | Indoor and Built Environment / SAGE, 2023 |
| non démontrée | `vingt-vingt-vingt` | PubMed 36473088 |
| non démontrée | `lumiere-bleue` | Singh et al., Cochrane, 2023 |

---

## 5. Où le contenu manque

Priorisé. Chaque mission dit ce qu'il faut chercher, ce qui compte comme preuve
suffisante, et ce qu'il faut livrer.

### Mission 1 — L'exposition de base n'est nulle part chiffrée

**Le problème.** Toute l'app repose sur « vous êtes assis trop longtemps », et
aucun article ne dit combien de temps un employé de bureau passe réellement
assis, ni à partir de quel seuil c'est associé à quoi. C'est la fondation
manquante, et c'est la première chose qu'un lecteur sceptique demande.

**À chercher.** Études d'accélérométrie sur des populations de bureau (durée
assise quotidienne mesurée, pas déclarée) ; méta-analyses dose-réponse entre
temps assis et mortalité ou risque cardiométabolique ; travaux sur l'effet
modérateur de l'activité physique par ailleurs.

**Attention.** C'est un domaine où les gros titres dépassent largement les
données, et où les études anciennes reposent sur du déclaratif. Le niveau de
preuve honnête est probablement `partielle`, pas `solide`.

**Livrable.** Un article, tag `preuve`, qui donne un chiffre d'exposition
mesuré et dit franchement ce que la relation dose-réponse permet et ne permet
pas de conclure.

### Mission 2 — Les poignets n'ont aucun article

**Le problème.** La zone `poignets` contient cinq mouvements. Le seul article
vers lequel ils renvoient est `regler-son-poste`, une pièce d'ergonomie
générale. Rien ne dit si ces cinq mouvements servent à quelque chose.

**À chercher.** Revues sur le syndrome du canal carpien et le travail sur
clavier ; essais sur les exercices de glissement nerveux (*nerve gliding*) ;
la littérature sur les troubles musculo-squelettiques du membre supérieur liés
à l'écran.

**Attention.** Le lien entre frappe au clavier et canal carpien est
contesté ; plusieurs revues ne le retrouvent pas. Si c'est le cas, l'article
doit le dire, et le niveau sera `non-demontree` ou `partielle`. Un article
honnête qui conclut « ces mouvements soulagent peut-être, ils ne préviennent
rien de démontré » est un bon article pour cette app.

**Livrable.** Un article, plus la mise à jour du champ `articles` des cinq
mouvements de poignet.

### Mission 3 — Les yeux n'ont que des résultats négatifs

**Le problème.** Les deux articles de la zone `yeux` disent tous les deux que
quelque chose ne marche pas : le 20-20-20 et les verres anti-lumière bleue.
L'app propose une routine « Yeux » et n'a rien de positif à opposer. C'est un
trou qu'elle a creusé elle-même.

**À chercher.** Ce qui est démontré sur la fatigue visuelle numérique :
clignement volontaire et film lacrymal, larmes artificielles, distance et
hauteur d'écran, humidité et flux d'air, éclairage ambiant.

**Livrable.** Un article `pratique` ou `reglage` qui dit ce qui a un effet
mesuré sur l'inconfort visuel, avec son niveau de preuve.

### Mission 4 — Neuf zones sur dix n'ont qu'une seule routine

**Le problème.** Seule la zone `bureau` en a quatre. Quelqu'un qui ouvre
« Nuque » deux jours de suite fait exactement les mêmes sept mouvements. C'est
la cause d'abandon la plus probable une fois l'app installée.

**À chercher / concevoir.** Une deuxième routine pour au moins `nuque`, `dos`,
`lombaires` et `hanches`. Elles peuvent recomposer des mouvements existants
dans un autre ordre et une autre durée, ce qui ne coûte aucun dessin. Une
routine courte (60 à 90 s) et une longue par zone est un bon découpage.

**Contrainte.** Toute routine composée uniquement de mouvements existants peut
être livrée immédiatement. Un mouvement réellement nouveau demande une
illustration, voir §6.2.

### Mission 5 — Les chevilles et la circulation

**Le problème.** Trois mouvements de chevilles, aucun article sur ce à quoi ils
servent. L'article `debout-nest-pas-actif` mentionne les varices et la
thrombose veineuse en passant, sans jamais y revenir.

**À chercher.** Stase veineuse en position assise prolongée ; effet de la
pompe musculaire du mollet ; littérature sur la thrombose du voyageur, qui est
le modèle le plus étudié de l'immobilité assise prolongée.

### Mission 6 — Les articles orphelins

Deux articles ne sont reliés qu'à deux mouvements chacun : `lumiere-du-jour` et
`expiration-plus-longue`. Ce sont pourtant deux des contenus les plus solides.
Passer en revue les 42 mouvements et rattacher ceux qui le méritent est un
travail court à fort effet, sans aucune recherche nouvelle.

### Missions ouvertes, moins prioritaires

- **Télétravail contre bureau** : l'app a un réglage de lieu et aucun contenu
  qui l'explique au-delà de la discrétion en open space.
- **La pause déjeuner** : sortir marcher, l'effet sur l'après-midi.
- **Le renforcement, qui n'est pas dans l'app** : l'article
  `muscler-le-haut-du-dos` dit que c'est l'intervention la mieux démontrée et
  qu'elle est absente. Faut-il l'ajouter ? C'est une décision produit, pas une
  décision de contenu, mais la recherche préalable a sa place ici.
- **Hauteur d'écran et posture de la nuque** : `regler-son-poste` l'effleure.

---

## 6. Contraintes dures

### 6.1 Slugs câblés dans le code, à ne jamais renommer

Ces slugs de routine sont référencés en dur. Les renommer casse silencieusement
une fonctionnalité.

| Slug | Où | Conséquence si renommé |
|---|---|---|
| `debout` | `src/features/reminders/kinds.ts` | le rappel « se lever » n'ouvre plus rien |
| `hanches` | idem | le rappel mobilité n'ouvre plus rien |
| `yeux` | idem | le rappel des yeux n'ouvre plus rien |
| `respiration`, `reveil`, `nuque`, `express`, `bureau-complet`, `dos`, `poignets`, `chevilles`, `lombaires`, plus les trois ci-dessus | `src/features/session/daypart.ts` | la carte de conseil de l'accueil se rabat sur autre chose |

`daypart.ts` dégrade proprement si un slug est absent du catalogue, mais la
suggestion prévue disparaît sans avertissement.

### 6.2 Les illustrations sont une ressource limitée

Il existe **43 clés de figure** déclarées dans
`src/components/figures/figureKeys.ts`, dessinées en SVG à la main dans le même
style, deux tons, sans dépendance externe. Quatre ne sont utilisées par aucune
étape et sont donc disponibles immédiatement :

`chat-vache-b`, `omoplates-b`, `doigts-poing`, `mollet-plat`

Les clés en `-b` sont des **secondes positions** : un mouvement à deux temps est
animé en alternant deux dessins. Elles ne conviennent qu'à un mouvement qui a
deux phases visibles.

**Un mouvement réellement nouveau demande un nouveau dessin.** Ce n'est pas du
travail de contenu, et le test `content.test.ts` refuse toute étape dont la
`figureKey` n'existe pas. En pratique : privilégier les routines recomposées à
partir des mouvements existants, et regrouper les demandes de nouveaux dessins
en un lot.

### 6.3 La discrétion en open space change la composition

`discreet: false` sur un mouvement le retire des routines quand l'utilisateur
est réglé sur « Au bureau ». Deux règles suivent, dans
`src/features/place/place.ts` :

- Si moins de la moitié des étapes survivent, la routine est laissée **entière**
  et signalée « plutôt à la maison » plutôt que vidée. `reveil` est dans ce cas :
  deux mouvements sur neuf survivent.
- La fiche annonce combien de mouvements ont été retirés.

Donc **une routine composée majoritairement de mouvements peu discrets ne sera
jamais servie au bureau**, qui est le contexte principal de l'app. À vérifier au
moment de la concevoir.

### 6.4 Les tests que le contenu doit passer

`pnpm test` fait tourner `src/content/content.test.ts`, qui refuse notamment :

- une routine dont la `durationS` ne fait pas la somme de ses étapes ;
- des positions d'étapes qui ne vont pas de 1 à n ;
- une `figureKey` ou un `exerciseKey` inexistant ;
- un mouvement qui n'est référencé par aucune routine ;
- un mouvement dont la liste `articles` est vide, ou pointe vers un article
  absent ;
- un mouvement sans `easier`, sans `muscles` ou sans `avoid` ;
- un article sans aucune illustration, ou avec une clé de figure inexistante ;
- une zone qui ne contient aucune routine ;
- deux slugs identiques.

### 6.5 Le pipeline

```
src/content/*.json          écrit à la main
        │
        │  pnpm gen:seed   (lancé aussi par le pretest)
        ▼
db/002_seed_content.sql     généré, à committer, jamais édité
        │
        ▼
base Neon                   pnpm db:migrate
```

L'app embarque le JSON comme repli hors ligne et lit la base quand elle est
joignable. Les deux ne peuvent pas diverger, c'est le rôle du générateur.

Un ajout de contenu se termine donc par : `pnpm gen:seed && pnpm test`, puis le
commit du JSON **et** du SQL régénéré.

---

## 7. Comment livrer

1. Écrire directement dans `src/content/routines.json`,
   `src/content/exercises.json` ou `src/content/articles.json`.
2. Pour chaque article : slug, titre, dek d'une phrase, tag, **niveau de preuve
   assumé**, temps de lecture réaliste, libellé et URL de la source primaire,
   corps en markdown avec au moins une `::figure` et une section de limites.
3. Rattacher le nouvel article aux mouvements concernés, dans leur champ
   `articles`.
4. `pnpm gen:seed && pnpm test && pnpm lint`.
5. Committer le JSON et le SQL généré ensemble.

### Ce qui fait refuser un contenu

- Un chiffre sans source consultable.
- Un niveau de preuve plus flatteur que ce que la source permet.
- Un article qui ne dit pas ses limites.
- Un ton qui félicite, culpabilise ou promet un bénéfice santé.
- Une promesse thérapeutique.
- Un mouvement sans son signe d'arrêt (`avoid`) ni sa version plus facile
  (`easier`).

---

## 8. Où lire le reste

| Quoi | Où |
|---|---|
| Le contenu | `src/content/*.json` |
| Les règles de validation | `src/content/content.test.ts` |
| Les clés d'illustration | `src/components/figures/figureKeys.ts` |
| Zones et familles | `src/content/index.ts` |
| Le moteur de rappels | `src/features/reminders/`, `src/stores/session.ts` |
| Les suggestions par heure | `src/features/session/daypart.ts` |
| L'adaptation open space | `src/features/place/place.ts` |
| Chaque décision de conception, avec sa raison | `DECISIONS.md` |
| Installation, base, build | `README.md`, `db/README.md` |
