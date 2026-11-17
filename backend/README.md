# VOSTFR AI - Backend FastAPI

## Prérequis

- Python 3.10+
- PostgreSQL
- FFmpeg et ffprobe installés et dans le PATH

## Démarrage

```bash
cd backend

python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Éditer .env avec vos identifiants PostgreSQL
```

Créer la base puis importer le schéma :

```bash
createdb vostfr_ai
psql -d vostfr_ai -f schema.sql
```

Le schéma est non destructif : il peut être réimporté sans supprimer les données.

Lancer le serveur :

```bash
./start-local.sh
```

ou manuellement :

```bash
uvicorn app.main:app --reload --port 8000
```

- API : http://localhost:8000
- Documentation Swagger : http://localhost:8000/docs

## Base PostgreSQL locale du projet

Une instance PostgreSQL dédiée est installée dans `backend/.pgdata` et écoute sur
le port **5433** (le port 5432 peut être utilisé par un autre serveur système).

Connexion pgAdmin :

- Hôte : `localhost`
- Port : `5433`
- Utilisateur : `cherykpoviessi`
- Base : `vostfr_ai`

`./start-local.sh` démarre cette instance si nécessaire puis lance FastAPI.

## Variables d'environnement

| Variable | Description |
|---|---|
| `DATABASE_URL` | URL PostgreSQL, ex. `postgresql+psycopg://user:password@localhost:5432/vostfr_ai` |
| `SECRET_KEY` | Clé de signature des JWT |
| `UPLOAD_DIR` | Dossier de stockage des vidéos et sous-titres |
| `MAX_UPLOAD_SIZE` | Taille maximale d'un upload en octets |
| `FILE_RETENTION_HOURS` | Délai avant suppression automatique (vidéo + sous-titres + entrée) après génération (`2`, `0` = désactivé) |
| `CLEANUP_INTERVAL_MINUTES` | Fréquence de la tâche de nettoyage en minutes (`10`) |
| `ORPHAN_FILE_GRACE_MINUTES` | Délai avant suppression des fichiers sur disque absents de la base (`60`) |
| `WHISPER_MODEL` | Modèle Faster-Whisper local (`tiny`, `base`, `small`, `medium`, `large-v3`) |
| `TRANSCRIPTION_PROVIDER` | `groq` (en ligne, recommandé) ou `local` (Whisper CPU) |
| `TRANSLATION_PROVIDER` | `groq` (recommandé), `libretranslate` ou `google` |
| `GROQ_API_KEY` | Clé API Groq (gratuite sur https://console.groq.com/keys) |
| `GROQ_API_BASE` | Base de l'API Groq (`https://api.groq.com/openai/v1`) |
| `GROQ_WHISPER_MODEL` | Modèle de transcription (`whisper-large-v3-turbo`) |
| `GROQ_TRANSLATION_MODEL` | Modèle de traduction (`openai/gpt-oss-120b`) |
| `GROQ_MAX_AUDIO_BYTES` | Taille max d'un envoi audio à Groq (25 Mo en gratuit) |
| `GROQ_AUDIO_CHUNK_SECONDS` | Durée des découpes audio pour les longues vidéos |
| `TRANSLATION_API_URL` | API de traduction compatible LibreTranslate (optionnel) |
| `TRANSLATION_API_KEY` | Clé de l'API de traduction (optionnel) |

Avec `TRANSCRIPTION_PROVIDER=groq` et `TRANSLATION_PROVIDER=groq`, tout passe en ligne via
Groq : aucun GPU n'est utilisé et les longues vidéos sont automatiquement découpées en
chunks audio sous la limite de taille. Sans `GROQ_API_KEY`, le backend retombe
automatiquement sur Whisper local (CPU) et Google Translate.

## Endpoints

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Création de compte + JWT |
| POST | `/api/auth/login` | Connexion + JWT |
| GET | `/api/auth/me` | Utilisateur courant |
| PUT | `/api/auth/me` | Mise à jour du profil |
| POST | `/api/auth/change-password` | Changement de mot de passe |
| GET | `/api/settings` | Préférences de traduction et notifications |
| PUT | `/api/settings` | Mise à jour des préférences |
| POST | `/api/projects/upload` | Upload d'une vidéo |
| GET | `/api/projects` | Liste des projets |
| GET | `/api/projects/{id}` | Détail d'un projet |
| POST | `/api/projects/{id}/translate` | Lance la transcription/traduction |
| GET | `/api/projects/{id}/progress` | Progression |
| GET | `/api/projects/{id}/subtitles` | Segments de sous-titres |
| GET | `/api/projects/{id}/download?format=srt` | Télécharge le SRT ou VTT |
| DELETE | `/api/projects/{id}` | Supprime le projet |

Toutes les routes `/api/projects` nécessitent l'en-tête `Authorization: Bearer <token>`.
