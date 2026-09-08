# Log Off

Pour les personnes qui travaillent assises et **souffrent déjà** de nuque, dos,
épaules ou poignets : le coach quotidien ultra-court qui structure la journée de
travail et cherche à réduire la douleur perçue, avec un plan adaptatif de
mobilité et de renforcement léger — en restant radicalement honnête sur les
preuves. **Android (Capacitor), thème sombre, français, hors-ligne d'abord.**

> Log Off n'est pas un dispositif médical. En cas de douleur qui persiste, un
> médecin ou un kiné tranchera mieux qu'une app.

## La boucle

1. **Premier lancement** — zones douloureuses, intensité 0-10 par zone, depuis
   quand, lieu de travail, minutes disponibles. Un premier plan est composé et
   lancé dans la foulée.
2. **La journée** — la session de travail et ses rappels, à l'intervalle choisi
   (30 min par défaut, 45 et 60 offerts).
3. **La séance** — le premier rappel qui trouve le plan du jour non fait l'ouvre :
   4 à 8 minutes, composées pour les zones qui font mal. Les rappels suivants
   redeviennent la pause courte, sinon ce serait seize minutes d'exercice par
   heure.
4. **La question** — « Comment est ta nuque maintenant ? », 0-10. C'est la seule
   mesure de résultat de l'app, et c'est l'utilisateur qui la donne.
5. **Le retour** — heatmap de douleur sur 7 / 14 / 30 jours, et le delta
   (« Nuque : 6 → 3 en 11 jours ») quand il y a de quoi le calculer.
6. **La série** — deux gels par mois civil, aucun ton punitif, aucune
   félicitation.

Le plan est **composé, pas choisi** : les zones sont classées sur la dernière
réponse, le renforcement est dosé sur la tendance à quatorze jours, et une zone
déclarée à 6/10 ou plus ne reçoit **aucune charge** — la revue citée ne trouve
aucune preuve sur la douleur aiguë. Voir `docs/PIVOT-COACH-DOULEUR.md`.

## Modèle économique

B2C freemium, avec abonnement — B2B envisagé plus tard. La frontière proposée
est en §5 de `docs/VALIDATION-PIVOT.md`, et elle a une règle : **on ne fait
jamais payer l'honnêteté.** Gratuit pour toujours — tous les articles avec leur
niveau de preuve, le catalogue complet, les rappels, le journal de douleur, une
séance composée par jour. Payant — l'historique au-delà de 30 jours, la
synchronisation multi-appareil, plusieurs séances par jour, l'export. Jamais
payant — le niveau de preuve, les limites d'un article, la question de fin de
séance, la version plus facile d'un mouvement et son signe d'arrêt.

## La doctrine, qui n'est pas négociable

- Chaque affirmation porte son **niveau de preuve** (`solide` / `partielle` /
  `non-demontree`), y compris quand il est faible, y compris contre l'app.
- **Aucun chiffre inventé.** Les seuls nombres affichés sont comptés, ou tapés
  par l'utilisateur. Un jour sans réponse est une case vide, jamais un zéro.
- Chaque article se termine sur **ses propres limites**.
- Ton factuel, tutoiement, **ni félicitations ni reproche** — vérifié par test.
- Aucune prétention médicale.

`docs/BRIEF-CONTENU.md` la détaille et dit ce qui fait refuser un contenu.

## Stack

- **Front** : React 18 + TypeScript, Vite, Tailwind v4 (tokens maison), Zustand,
  React Router (hash), `fetch` maison.
- **Mobile** : Capacitor 8 (edge-to-edge), notifications locales, OTA
  auto-hébergée via `@capgo/capacitor-updater` en mode manuel.
- **Back** : fonctions serverless Vercel (`/api`), Neon Postgres
  (`@neondatabase/serverless`), SQL paramétré à la main, auth `bcryptjs` + JWT
  `jose`.

## Démarrage (web, développement)

```bash
pnpm install
pnpm dev            # http://localhost:5173 — tourne sans backend (contenu seedé local)
```

Pour brancher l'API en local, lance aussi `vercel dev` (ou déploie sur Vercel) et
définis `VITE_API_BASE_URL`.

## Qualité

```bash
pnpm typecheck      # tsc --noEmit (front + api)
pnpm lint           # eslint, 0 warning toléré
pnpm test           # vitest — logique pure (composition du plan, journal de douleur,
                    #   planification, série, file, découpeur SQL)
pnpm build          # typecheck + build de production
```

## Base de données

Voir **`db/README.md`**. En résumé, une seule fois :

```bash
# 1. Créer le rôle releve_app + la base releve (rôle propriétaire Neon)
# 2. Appliquer le schéma et le contenu :
export DATABASE_URL='postgresql://releve_app:...@...neon.tech/releve?sslmode=require'
pnpm db:migrate
```

Le contenu (`db/002_seed_content.sql`) est **généré** depuis `src/content/*.json`
par `pnpm gen:seed` — ne l'édite pas à la main.

## Variables d'environnement (Vercel)

Voir `.env.example`. Aucune valeur réelle ne vit dans le dépôt.

| Clé | Rôle |
|---|---|
| `DATABASE_URL` | Neon, base `releve`, rôle `releve_app` — jamais l'autre base |
| `JWT_SECRET` | 64 octets aléatoires (`openssl rand -hex 64`) |
| `INVITE_CODE` | code exigé par `/api/auth/register` |
| `OTA_BASE_URL` | `https://<projet>.vercel.app` (aussi `VITE_API_BASE_URL` au build mobile) |

## Mise à jour automatique (OTA)

L'APK s'installe **une seule fois**. Ensuite, chaque push sur `main` déclenche
`.github/workflows/ota.yml` : build, bump du patch, zip de `dist/` en
`public/ota/bundle-<version>.zip`, réécriture de `public/ota/manifest.json`, puis
Vercel déploie. L'app prend la mise à jour au lancement suivant.

En local : `pnpm ota:local` (après `pnpm build`).

La version du bundle qui tourne réellement est affichée en bas de l'écran
**Réglages**.

## Construire et signer l'APK

### Créer le keystore (une seule fois)

```bash
keytool -genkey -v -keystore releve-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias releve
```

Range le `.jks` **hors du dépôt** et crée `android/keystore.properties`
(git-ignoré) à partir de `android/keystore.properties.example`.

### Build local

```bash
pnpm build && pnpm exec cap sync android
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

### Build en CI

Pousse un tag `vX.Y.Z` : `.github/workflows/apk.yml` construit l'APK signé et
l'attache à une **GitHub Release**. Secrets requis :
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`, et la variable `OTA_BASE_URL`.

## Installation (sideload)

Télécharge l'APK depuis la dernière **GitHub Release**, autorise l'installation
depuis une source inconnue, installe. C'est le seul canal d'installation — pas de
Play Store.

## Structure

Voir l'arborescence dans le mégaprompt (§4). Le cœur de l'app est
`src/features/reminders/` (planification, notifications, file hors ligne).

## Confidentialité

Aucune donnée ne quitte l'app en dehors de son propre backend. Pas d'analytics,
pas de publicité, pas de crash reporter tiers.

## Déploiement production (Vercel via GitHub Actions)

Le workflow `.github/workflows/deploy-vercel.yml` déploie en production à chaque
push sur `main` — sans avoir à connecter le dépôt dans le dashboard Vercel.

À configurer **une fois** dans GitHub → **Settings → Secrets and variables → Actions** :

- Secret **`VERCEL_TOKEN`** — Vercel → Account Settings → Tokens.
- Variable **`VERCEL_ORG_ID`** et variable **`VERCEL_PROJECT_ID`** — récupérées via
  `vercel link` en local, ou dans Vercel → Project → Settings.

Les variables d'exécution de l'app (`DATABASE_URL`, `JWT_SECRET`, `INVITE_CODE`,
`OTA_BASE_URL`) restent définies **dans le projet Vercel** ; `vercel pull` les
récupère au moment du build. Ne les mets jamais dans le dépôt.

> Choisis **un seul** mécanisme de déploiement : soit ce workflow, soit
> l'intégration Git native de Vercel (dashboard). Les deux en même temps
> déclenchent des déploiements en double.
