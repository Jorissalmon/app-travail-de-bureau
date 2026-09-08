# Log Off

Application Android personnelle qui rappelle de se lever et de bouger pendant les
journées de bureau, propose des routines guidées courtes, et explique pourquoi
via une section d'articles. **Thème sombre, français, hors-ligne d'abord.**

> Ce n'est pas un produit à vendre, ni un dispositif médical. Priorité : que ça
> marche tous les jours sans y penser.

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
pnpm test           # vitest — logique pure (planification, série, file, semver)
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
