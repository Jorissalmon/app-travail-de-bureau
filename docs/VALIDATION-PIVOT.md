# Validation du pivot — hypothèses, seuils, protocole

Ce document dit ce qui devrait être vrai si le pivot marche, comment on le
saura, et — la partie qui compte — **ce qui le ferait déclarer raté**. Il est
écrit avant la bêta, exprès : un seuil choisi après avoir vu les données n'est
pas un seuil.

Il applique au produit la même règle que la doctrine applique au contenu : une
affirmation porte son niveau de preuve, et un chiffre qui ne peut pas être
compté n'est pas affiché.

---

## 1. Les hypothèses

Trois, dans l'ordre où elles doivent tomber. Chacune a une hypothèse nulle
explicite, parce que sans ça on trouve toujours quelque chose.

### H1 — La douleur déclarée est un motif de retour

*Quelqu'un qui a mal revient plus qu'un lecteur curieux.*

- **Falsifiable par** : une rétention D30 de la cohorte « douleur ≥ 3/10 » qui
  n'est pas supérieure à celle de la cohorte « aucune zone déclarée ».
- **H0** : les deux cohortes se comportent pareil, et la douleur n'est pas le
  levier — c'est le format court qui l'est.

### H2 — La douleur perçue baisse chez ceux qui pratiquent

*Sur quatorze jours, les réponses des pratiquants réguliers descendent.*

- **Falsifiable par** : un Δ moyen J0 → J14 supérieur à -1,5 point, ou un Δ
  indiscernable entre pratiquants réguliers et pratiquants occasionnels.
- **H0** : la baisse observée est une régression vers la moyenne — on s'inscrit
  un jour où on a particulièrement mal, et la semaine suivante est simplement
  ordinaire. **C'est l'explication la plus probable d'une baisse, et il faut la
  traiter comme telle** (§4.2).

### H3 — Le plan adaptatif fait mieux qu'une routine fixe

*Composer une séance vaut mieux que servir la routine de la zone.*

- **Falsifiable par** : pas de différence de complétion ni de rétention entre le
  bras « plan » et un bras « routine fixe de la zone la plus douloureuse ».
- **H0** : l'adaptation est cosmétique, et ce qui retient est simplement d'avoir
  une chose à faire par jour.

---

## 2. Les seuils

Les quatre du cahier des charges, plus les conditions de lecture sans lesquelles
un chiffre ne veut rien dire.

| # | Métrique | Seuil | Population | Fenêtre |
|---|---|---|---|---|
| K1 | Rétention D30 | **≥ 35 %** | cohorte « douleur ≥ 3/10 » à l'inscription | 30 j après J0 |
| K2 | Δ douleur moyenne J0 → J14 | **≤ -1,5 point** | mêmes, ≥ 2 réponses espacées de ≥ 7 j | 14 j |
| K3 | Taux de complétion de séance | **≥ 65 %** | toutes séances lancées | toute la bêta |
| K4 | Régression doctrine | **zéro** | audit de contenu | à la sortie |

**Définitions, pour qu'elles ne bougent pas en route.**

- *Cohorte « douleur ≥ 3/10 »* : au moins une zone notée ≥ 3 au premier
  lancement (`onboarding_completed.maxPain ≥ 3`). Fixée à l'inscription et
  jamais recalculée — sinon on sélectionne sur la variable qu'on mesure.
- *J0* : le jour de `onboarding_completed`.
- *Retenu à D30* : au moins une `session_completed` entre J23 et J30. Pas « a
  ouvert l'app » : ouvrir n'est pas utiliser, et une app qui compte les
  ouvertures se ment à elle-même.
- *Δ douleur* : moyenne journalière de la **zone primaire** au premier jour de
  réponse, moins la même au dernier, à J14 au plus tard. Calculé par
  `painStats.delta`, la fonction même qui alimente l'écran — l'analyse et
  l'affichage ne peuvent pas diverger.
- *Complétion* : `session_completed` ÷ `session_started`, sur le même identifiant
  de séance. Une séance quittée puis reprise compte deux départs et une
  complétion, ce qui est la lecture sévère et donc la bonne.

**Taille minimale.** En dessous de **60 inscrits dans la cohorte douleur**,
aucun de ces seuils n'est lu. À n = 20, un écart de 15 points de rétention est
du bruit, et publier ce bruit en interne est le début d'une décision produit
mal fondée.

---

## 3. Les événements, et à quoi chacun sert

Tous dans `src/features/analytics/events.ts`. Aucun SDK tiers, aucun texte
libre, un tampon local borné à 500 entrées. Une app dont l'argument est « on ne
t'invente pas de chiffres » ne peut pas embarquer un traceur qui les revend.

| Événement | Charge utile | Sert à |
|---|---|---|
| `onboarding_started` | — | dénominateur du tunnel |
| `onboarding_step` | `step` | où on décroche |
| `onboarding_completed` | `seconds`, `zones`, `maxPain`, `minutes`, `place` | **cohorte** (K1, K2), J0, cible des 90 s |
| `onboarding_abandoned` | `step` | tunnel |
| `plan_shown` | `goal`, `zones`, `strengthBlocks`, `durationS` | vérifier que le plan varie réellement |
| `session_started` | `kind`, `slug`, `source`, `durationS` | **dénominateur K3** |
| `session_completed` | `kind`, `slug`, `durationS` | **numérateur K3**, définition de « retenu » (K1) |
| `session_abandoned` | `kind`, `slug`, `atBlock` | à quel bloc on lâche |
| `pain_rated` | `zone`, `score`, `source` | **série K2** |
| `pain_skipped` | `zone` | taux de réponse à la question de fin |
| `plan_adapted` | `zone`, `from`, `to`, `strengthBlocks` | **preuve que l'adaptation n'est pas cosmétique (H3)** |
| `reminder_acted` | `kind`, `action` | efficacité du rappel contextuel |
| `reminder_backoff` | `misses`, `nextInMin` | le snooze recule-t-il ou l'app relance-t-elle |
| `streak_freeze_used` | `left` | un gel qui ne se déclenche jamais est un mensonge |
| `place_changed` | `place` | le filtre de discrétion est la première cause de plan pauvre |
| `article_opened` | `slug`, `evidence`, `from` | est-ce que la doctrine est lue, ou seulement affichée |

**Ce qui n'est pas collecté, et pourquoi.** Aucun texte saisi, aucune donnée de
santé au-delà des réponses 0-10, aucun identifiant d'appareil ou de publicité,
aucun horodatage plus fin que la seconde. Les quatre métriques n'en ont pas
besoin, et un événement qui ne sert aucune d'elles n'a rien à faire dans le
fichier.

**Ce qu'il manque encore** : les événements sont écrits localement et ne sont
drainés nulle part. Avant la bêta il faut soit un endpoint `/api/analytics`, soit
un export manuel depuis le profil. Sans l'un des deux, aucun de ces seuils n'est
mesurable — c'est le premier travail à faire.

---

## 4. Protocole de bêta

### 4.1 Format

- **Durée** : 60 jours après le soft launch. Lecture à J30 (indicative) et à
  J60 (décisive).
- **Recrutement** : personnes travaillant assises, se déclarant gênées à la
  nuque, au dos, aux épaules ou aux poignets. Aucun critère d'exclusion médical
  n'est appliqué par l'app — elle n'est pas un dispositif médical et n'a pas à
  trier — mais l'annonce dit en clair qu'une douleur qui dure appelle un avis.
- **Cible** : 150 inscrits pour espérer 60 à 80 dans la cohorte douleur.
- **Deux bras, assignés à l'inscription** :
  - **A — plan adaptatif** (ce qui est construit ici).
  - **B — routine fixe**, servie chaque jour pour la zone la plus douloureuse
    déclarée, sans recomposition ni dosage du renforcement. Le contenu est
    identique, seule la composition change.

Sans le bras B, H3 n'est pas testable et on ne saura jamais si l'adaptation
valait le code qu'elle a coûté.

### 4.2 Traiter la régression vers la moyenne

C'est le principal risque de se mentir sur K2. Trois garde-fous :

1. **Deux points de départ.** La note du premier lancement, et une deuxième à
   J3. Le Δ est calculé depuis la seconde. Une note d'inscription est prise un
   jour où on a mal — c'est ce qui pousse à installer l'app.
2. **Le bras B est le témoin.** Une régression vers la moyenne frappe les deux
   bras également. Ce qui compte pour H3 est l'écart A − B, pas la baisse de A.
3. **La cohorte « aucune zone déclarée »** sert de troisième repère pour K1.

Rien de tout cela ne fait de la bêta un essai contrôlé. Ce n'en est pas un : pas
d'aveugle, pas de randomisation stratifiée, auto-sélection totale, mesure
auto-rapportée. **Aucun résultat de cette bêta ne peut être communiqué comme un
effet démontré**, et surtout pas dans l'app.

### 4.3 Audit doctrine (K4)

À faire à la sortie, et à refaire à chaque ajout de contenu. `pnpm test` couvre
déjà la partie mécanique ; le reste se lit :

- [ ] Aucun chiffre affiché qui ne soit pas compté ou tapé par l'utilisateur.
- [ ] Chaque nouvel article porte un niveau de preuve que sa source soutient.
- [ ] Chaque article a sa section de limites.
- [ ] Aucune félicitation, aucun reproche, aucune promesse thérapeutique.
- [ ] Chaque mouvement de renforcement a un `avoid` réel, pas « rien de
      spécifique » *(vérifié par test)*.
- [ ] Tout reste compatible avec « Log Off n'est pas un dispositif médical. »
- [ ] Les écrans de résultat ne convertissent jamais une réponse 0-10 en
      pourcentage, en indice ou en bénéfice.

### 4.4 Ce qu'on fait du résultat

| Situation | Décision |
|---|---|
| K1, K2, K3 atteints | On garde, on construit l'abonnement |
| K1 atteint, K2 non | La rétention ne vient pas du soulagement. Il faut savoir d'où elle vient avant de facturer quoi que ce soit sur une promesse de soulagement |
| K2 atteint, K1 non | Ça marche pour ceux qui restent, et ils sont trop peu. Problème d'onboarding ou de rappel, pas de contenu |
| A ≈ B | L'adaptation est cosmétique. Simplifier, garder la question de fin, jeter le compositeur |
| n < 60 | On ne conclut rien et on prolonge le recrutement |

---

## 5. Frontière freemium proposée

Non construite, posée ici pour être discutée. La règle est qu'on ne fait jamais
payer l'honnêteté.

**Gratuit, pour toujours** : tous les articles avec leur niveau de preuve, le
catalogue complet des routines, les rappels de lever, le journal de douleur et
son historique, une séance composée par jour.

**Payant** : l'historique au-delà de 30 jours, la synchronisation multi-appareil,
plusieurs séances composées par jour, l'export des données.

**Jamais payant** : le niveau de preuve, les limites d'un article, la question de
fin de séance, la version plus facile d'un mouvement, son signe d'arrêt. Mettre
un `avoid` derrière un paywall serait le seul vrai échec possible de ce produit.
