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
--
-- NOTE : les textes des sous-titres ne sont plus stockés en base.
-- Ils restent uniquement dans les fichiers SRT/VTT sur le disque.
-- La table "translations" est supprimée par la migration en fin de fichier.

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

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    original_filename VARCHAR NOT NULL,
    video_filename VARCHAR NOT NULL,
    duration VARCHAR,
    source_language VARCHAR DEFAULT 'auto',
    target_language VARCHAR DEFAULT 'fr',
    status VARCHAR DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    segments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_projects_id ON projects(id);

CREATE TABLE IF NOT EXISTS subtitles (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR NOT NULL,
    format VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_subtitles_id ON subtitles(id);

CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    preferred_language VARCHAR DEFAULT 'fr',
    theme VARCHAR DEFAULT 'dark',
    translation_preferences JSON DEFAULT '{}'::json,
    notifications JSON DEFAULT '{}'::json
);

CREATE INDEX IF NOT EXISTS ix_settings_id ON settings(id);

-- Migrations pour les bases existantes :
-- 1. Compteur de segments stocké sur le projet (plus de table translations).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS segments_count INTEGER DEFAULT 0;

-- 2. Le texte des sous-titres reste uniquement dans les fichiers SRT/VTT.
ALTER TABLE subtitles DROP COLUMN IF EXISTS content;

-- 3. Suppression de l'ancienne table qui stockait les textes traduits.
--    Les données ont été exportées dans backend/storage/exports/translations.csv.
DROP TABLE IF EXISTS translations CASCADE;

-- 4. Date de fin de génération : sert au nettoyage automatique des fichiers
--    et de l'entrée projet après FILE_RETENTION_HOURS (2 h par défaut).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- 5. La base ne stocke plus de chemins/liens, uniquement les noms de fichiers.
--    Les chemins sont reconstruits par le backend (UPLOAD_DIR + sous-dossier).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'video_path'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'video_filename'
    ) THEN
        ALTER TABLE projects RENAME COLUMN video_path TO video_filename;
    END IF;
END $$;

UPDATE projects
SET video_filename = regexp_replace(video_filename, '^.*/', '')
WHERE video_filename LIKE '%/%';

ALTER TABLE subtitles DROP COLUMN IF EXISTS file_path;

UPDATE subtitles
SET filename = regexp_replace(filename, '^.*/', '')
WHERE filename LIKE '%/%';

-- 6. Préférences de notifications par utilisateur.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS notifications JSON DEFAULT '{}'::json;

-- 7. Espace administrateur : rôles, crédits et sessions.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'user' NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- Les tables de l'espace admin (plans, abonnements, transactions, journal,
-- notifications, tickets, codes promo, secrets API, paramètres globaux…) sont
-- créées automatiquement par SQLAlchemy au démarrage de l'API.

COMMIT;
