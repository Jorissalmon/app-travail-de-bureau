# Base de données — Log Off

Log Off utilise le **projet Neon Postgres déjà en place**, mais dans une **base et
un rôle dédiés**. On ne lit, n'écrit et ne migre **rien** dans la base de l'autre
application du projet (§C2).

## 1. Créer la base et le rôle dédiés (une seule fois)

À exécuter **avec le rôle propriétaire du projet Neon** (celui du dashboard) :

```sql
-- 32 caractères générés, à conserver dans un gestionnaire de mots de passe
CREATE ROLE releve_app WITH LOGIN PASSWORD '<mot de passe généré>';
CREATE DATABASE releve OWNER releve_app;
```

Puis, **connecté à la base `releve`** :

```sql
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO releve_app;
```

## 2. Isolation vis-à-vis de l'autre application

- Postgres ne permet pas de lire une autre base depuis celle-ci sans `dblink` /
  `postgres_fdw`, qui ne sont pas installés sur Neon. **L'isolation des données
  est donc acquise du seul fait d'utiliser une base distincte.**
- Par défaut, `PUBLIC` a le droit `CONNECT` sur toutes les bases : `releve_app`
  pourrait _ouvrir_ une connexion vers l'autre base, sans pour autant y lire quoi
  que ce soit (aucun `GRANT` sur ses tables). Pour fermer même cette porte :

  ```sql
  REVOKE CONNECT ON DATABASE <autre_base> FROM PUBLIC;
  ```

  **Mais vérifie d'abord que le rôle applicatif de l'autre app a bien un
  `GRANT CONNECT` explicite**, sinon tu la casses. Ne fais cette révocation que si
  tu confirmes ce point. Elle est **optionnelle** et hors du périmètre de Log Off.
- La chaîne de connexion de Log Off va dans `DATABASE_URL` côté Vercel. Elle
  **ne doit jamais** pointer vers l'autre base.

## 3. Appliquer les migrations

Deux fichiers, dans l'ordre :

1. `001_init.sql` — schéma.
2. `002_seed_content.sql` — contenu (routines + articles). **Généré** depuis
   `src/content/*.json` par `pnpm gen:seed` ; ne l'édite pas à la main.

### Option A — script fourni

```bash
# DATABASE_URL doit pointer sur la base "releve", rôle releve_app
export DATABASE_URL='postgresql://releve_app:...@...neon.tech/releve?sslmode=require'
pnpm db:migrate          # applique 001 puis 002
pnpm db:migrate --seed-only   # ré-applique seulement le contenu (002)
```

Le script utilise le driver HTTP `@neondatabase/serverless`, donc il fonctionne
même là où le port Postgres 5432 est bloqué (le port 443 suffit).

### Option B — psql

```bash
psql "$DATABASE_URL" -f db/001_init.sql
psql "$DATABASE_URL" -f db/002_seed_content.sql
```

## 4. Variable d'environnement Vercel

Dans le projet Vercel, définis `DATABASE_URL` avec la chaîne du rôle `releve_app`
vers la base `releve`. Ne réutilise jamais la chaîne du rôle propriétaire.
