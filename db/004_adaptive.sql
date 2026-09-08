-- Log Off — 004 : le coach douleur adaptatif (§ pivot).
--
-- Trois colonnes de contenu et un journal de douleur. Le contenu reste
-- generee par scripts/gen-seed.ts ; ce fichier ne fait qu ouvrir la place
-- ou 002 vient ecrire.
--
-- Le decoupeur (scripts/sql-split.ts) saute les commentaires --, donc une
-- apostrophe ou un point-virgule ici ne coupe plus le fichier. Ce ne fut pas
-- toujours le cas : le point-virgule de la ligne 4 le coupait en plein milieu.

BEGIN;

-- Mobilite, renforcement, retour au calme. Defaut mobility : les 42
-- mouvements deja en base en sont, et le seed les repassera de toute facon.
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'mobility'
    CHECK (type IN ('mobility', 'strength', 'reset'));

-- Ce pour quoi une routine est composee, et les zones du corps qu elle
-- travaille reellement — qui ne sont pas la zone de rangement : « Debout »
-- vit sous `bureau` et travaille les hanches, le haut du dos et les mollets.
ALTER TABLE routines
  ADD COLUMN IF NOT EXISTS goal text NOT NULL DEFAULT 'prevention'
    CHECK (goal IN ('pain_relief', 'prevention', 'strength'));
ALTER TABLE routines
  ADD COLUMN IF NOT EXISTS target_zones text[] NOT NULL DEFAULT '{}';

-- Le journal de douleur. Une ligne = une reponse a la question de fin de
-- seance, ou la reponse du premier lancement. Rien n est calcule ici : la
-- colonne score est le chiffre que la personne a pose sur le curseur.
CREATE TABLE IF NOT EXISTS pain_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL,                 -- genere sur l appareil, idempotence
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  at         timestamptz NOT NULL,
  local_date date NOT NULL,
  zone       text NOT NULL,
  score      smallint NOT NULL CHECK (score BETWEEN 0 AND 10),
  source     text NOT NULL CHECK (source IN ('onboarding', 'post-session', 'manual')),
  routine_slug text,
  UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS pain_entries_user_date_idx
  ON pain_entries (user_id, local_date DESC);

COMMIT;
