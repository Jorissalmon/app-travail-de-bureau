-- 003 — Les préférences qui vivaient sur l'appareil, rattachées au compte.
--
-- Routines composées, durées par étape, sons du minuteur : trois choses que
-- l'utilisateur décide et qui, jusqu'ici, ne quittaient pas le téléphone où
-- elles avaient été décidées. Se connecter sur le web donnait donc un compte
-- vide, ce qui ressemble à une perte de données.
--
-- Un seul blob JSON plutôt qu'une table par sujet : les clés stockées sont
-- déjà celles de l'appareil, la synchronisation n'a donc rien à traduire, et
-- ajouter une préférence plus tard ne coûtera pas de migration. La règle de
-- conflit est le dernier écrivain gagne, arbitrée par updated_at — ce qui
-- suffit pour une personne et ses deux appareils.

CREATE TABLE IF NOT EXISTS user_prefs (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
