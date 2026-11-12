-- VOSTFR AI - Schéma PostgreSQL
--
-- IMPORTANT : ce fichier ne touche à aucun code de l'application.
-- Il crée seulement les tables si elles n'existent pas déjà.
-- Il peut être importé plusieurs fois sans supprimer les données existantes.
--
-- Utilisation :
--   1. Créer la base une seule fois (à exécuter sur la base "postgres") :
--        CREATE DATABASE vostfr_ai;
--   2. Se connecter à la base "vostfr_ai" dans pgAdmin / psql.
--   3. Exécuter ce fichier :
--        psql -U <utilisateur> -d vostfr_ai -f schema.sql
--
-- La DATABASE_URL du backend (backend/.env) doit pointer vers cette même base :
--   DATABASE_URL=postgresql+psycopg://<utilisateur>:<motdepasse>@localhost:5432/vostfr_ai

BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_id ON users(id);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    original_filename VARCHAR NOT NULL,
    video_path VARCHAR NOT NULL,
    duration VARCHAR,
    source_language VARCHAR DEFAULT 'auto',
    target_language VARCHAR DEFAULT 'fr',
    status VARCHAR DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_projects_id ON projects(id);

CREATE TABLE IF NOT EXISTS translations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    translated_text TEXT,
    start_time VARCHAR NOT NULL,
    end_time VARCHAR NOT NULL,
    sequence_number INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_translations_id ON translations(id);

CREATE TABLE IF NOT EXISTS subtitles (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR NOT NULL,
    file_path VARCHAR NOT NULL,
    format VARCHAR NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subtitles ADD COLUMN IF NOT EXISTS content TEXT;

CREATE INDEX IF NOT EXISTS ix_subtitles_id ON subtitles(id);

CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    preferred_language VARCHAR DEFAULT 'fr',
    theme VARCHAR DEFAULT 'dark',
    translation_preferences JSON DEFAULT '{}'::json
);

CREATE INDEX IF NOT EXISTS ix_settings_id ON settings(id);

COMMIT;
