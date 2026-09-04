-- Relève — schema. Apply against the dedicated "releve" database only.
-- See db/README.md for how the database and role are created.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON refresh_tokens (user_id);

CREATE TABLE settings (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  interval_min     smallint NOT NULL DEFAULT 30 CHECK (interval_min BETWEEN 15 AND 90),
  break_minutes    smallint NOT NULL DEFAULT 3  CHECK (break_minutes BETWEEN 1 AND 10),
  eye_reminders    boolean  NOT NULL DEFAULT false,
  mobility_times   time[]   NOT NULL DEFAULT ARRAY['10:30','15:30']::time[],
  quiet_start      time,
  quiet_end        time,
  weekdays         smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],  -- 1 = lundi
  auto_start_at    time,      -- démarrage auto de la session, NULL = manuel
  sound            boolean NOT NULL DEFAULT false,
  vibrate          boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE work_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz,
  local_date  date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON work_sessions (user_id, local_date DESC);

CREATE TYPE reminder_kind   AS ENUM ('stand','eyes','mobility');
CREATE TYPE reminder_action AS ENUM ('done','snoozed','dismissed','expired');

CREATE TABLE reminder_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL,          -- généré sur l'appareil, garantit l'idempotence
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  uuid REFERENCES work_sessions(id) ON DELETE SET NULL,
  kind        reminder_kind NOT NULL,
  fired_at    timestamptz NOT NULL,
  action      reminder_action NOT NULL,
  acted_at    timestamptz,
  local_date  date NOT NULL
);
CREATE UNIQUE INDEX ON reminder_events (user_id, client_id);
CREATE INDEX ON reminder_events (user_id, local_date DESC);

-- The full how-to for one movement: instructions, tips, an easier version,
-- the muscles worked, and the one thing that means "stop". Keyed by a stable
-- string (not a uuid) because it is a content identifier written by hand in
-- src/content/exercises.json, the same way a routine's zone or accent is.
CREATE TABLE exercises (
  key      text PRIMARY KEY,
  title    text NOT NULL,
  steps    text[] NOT NULL,
  tips     text[] NOT NULL DEFAULT '{}',
  easier   text NOT NULL,
  muscles  text[] NOT NULL,
  avoid    text NOT NULL,
  articles text[] NOT NULL DEFAULT '{}',
  discreet boolean NOT NULL DEFAULT true   -- faisable en open space
);

CREATE TABLE routines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  zone        text NOT NULL,          -- general | hanches | lombaires | nuque | dos | yeux
  duration_s  integer NOT NULL,
  summary     text NOT NULL,
  accent      text NOT NULL,          -- clé de couleur, voir §10.3
  sort_order  smallint NOT NULL DEFAULT 100
);

CREATE TABLE routine_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id    uuid NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  position      smallint NOT NULL,
  name          text NOT NULL,
  duration_s    integer NOT NULL,
  cue           text NOT NULL,          -- la consigne lue pendant l'étape
  figure_key    text NOT NULL,          -- clé de l'illustration, voir §10.4
  -- Le même mouvement revient dans plusieurs routines (une fente est une
  -- fente) ; sa fiche vit une seule fois dans `exercises`, ce champ y pointe.
  exercise_key  text NOT NULL REFERENCES exercises(key),
  UNIQUE (routine_id, position)
);

CREATE TABLE completions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  routine_id   uuid REFERENCES routines(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL,
  duration_s   integer NOT NULL,
  local_date   date NOT NULL
);
CREATE UNIQUE INDEX ON completions (user_id, client_id);
CREATE INDEX ON completions (user_id, local_date DESC);

CREATE TABLE articles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  title        text NOT NULL,
  dek          text NOT NULL,
  body_md      text NOT NULL,
  tag          text NOT NULL,         -- preuve | reglage | pratique
  evidence     text NOT NULL,         -- solide | partielle | non-demontree
  read_min     smallint NOT NULL,
  source_label text NOT NULL,
  source_url   text NOT NULL,
  sort_order   smallint NOT NULL DEFAULT 100
);
