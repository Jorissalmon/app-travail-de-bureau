-- Log Off — 005 : le journal analytique du pivot.
--
-- Quatre metriques decident si le pivot valait la peine (docs/VALIDATION-PIVOT.md).
-- Cette table est le seul endroit ou elles peuvent etre calculees. Elle est
-- deliberement pauvre : un nom pris dans une liste fermee, une charge utile
-- JSON de champs numeriques ou enumeres, rien de saisi par un humain.
--
-- Ne jamais mettre d apostrophe ASCII dans ces commentaires : le decoupeur de
-- scripts/migrate.ts ne saute pas les commentaires -- et la lirait comme une
-- chaine.

BEGIN;

CREATE TABLE IF NOT EXISTS analytics_events (
  id         bigserial PRIMARY KEY,
  client_id  uuid NOT NULL,               -- genere sur l appareil, idempotence
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  at         timestamptz NOT NULL,
  local_date date NOT NULL,
  name       text NOT NULL,
  -- Les champs de l evenement, moins son nom. Toujours un objet plat de
  -- nombres, de booleens et de valeurs prises dans un vocabulaire ferme.
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS analytics_events_user_name_idx
  ON analytics_events (user_id, name, local_date);

-- La cohorte se lit sur onboarding_completed.maxPain, la retention sur les
-- session_completed : cet index sert les deux lectures du protocole.
CREATE INDEX IF NOT EXISTS analytics_events_name_date_idx
  ON analytics_events (name, local_date DESC);

COMMIT;
