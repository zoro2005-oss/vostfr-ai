# VOSTFR AI — Documentation du projet

> Application de traduction de films et de génération de sous-titres `.srt` / `.vtt`.
> Ce document décrit l'ensemble du site (frontend, backend, API, base de données, pipeline)
> et détaille particulièrement **la transcription Whisper locale sur CPU**.

---

## 1. Vue d'ensemble

VOSTFR AI est composé de deux applications :

| Partie | Technologie | Rôle |
|---|---|---|
| Frontend | React + TypeScript + Vite | Interface SaaS (dashboard, import, suivi, résultats) |
| Backend | FastAPI + SQLAlchemy + PostgreSQL | Authentification, upload, transcription, traduction, génération SRT/VTT |

Le pipeline métier :

```
Vidéo uploadée
   └─► Extraction audio (FFmpeg → FLAC 16 kHz mono)
         └─► Transcription (Groq en ligne OU Whisper local CPU)
               └─► Traduction (Groq / LibreTranslate / Google)
                     └─► Génération SRT + VTT
                           └─► Stockage PostgreSQL + fichiers sur disque
```

Par défaut, **tout passe en ligne via Groq** (aucun GPU). Le **Whisper local CPU** est le
mode de secours automatique, ou un mode forcé si l'on ne veut aucune API externe pour la
transcription.

---

## 2. Stack technique

### Frontend
- React 18, TypeScript, Vite 6
- React Router 7 (`src/App.tsx`)
- Axios (`src/services/api.ts`)
- Recharts (graphique d'activité)
- Lucide React (icônes SVG)
- CSS simple dans `src/styles.css` (design iOS dark/light)
- Tailwind est installé mais **non utilisé** (le style est en CSS pur)

### Backend
- FastAPI, Uvicorn
- SQLAlchemy 2, Psycopg 3, PostgreSQL
- Pydantic / pydantic-settings
- JWT (`python-jose`) + bcrypt (`passlib`)
- HTTPX (appels Groq / LibreTranslate / Google)
- FFmpeg / ffprobe (extraction et découpage audio)
- Faster-Whisper + CTranslate2 (transcription locale CPU)
- Gestion des tâches longues via `BackgroundTasks` FastAPI

---

## 3. Arborescence

```
vostfr-ai/
├── index.html
├── package.json
├── .env.example                 # VITE_API_URL
├── DOCUMENTATION.md             # ce fichier
├── src/
│   ├── App.tsx                  # routes
│   ├── main.tsx                 # bootstrap + ThemeProvider
│   ├── styles.css               # design system complet
│   ├── services/api.ts          # axios + JWT + endpoints
│   ├── contexts/ThemeContext.tsx
│   ├── components/
│   │   ├── Layout.tsx           # sidebar, topbar, tab bar mobile
│   │   ├── Logo.tsx
│   │   ├── ProjectTable.tsx     # cartes "Traductions récentes"
│   │   └── StatCard.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── NewTranslation.tsx
│   │   ├── Processing.tsx
│   │   ├── Result.tsx
│   │   ├── History.tsx
│   │   ├── Settings.tsx
│   │   ├── Login.tsx
│   │   └── Register.tsx
│   ├── types/index.ts
│   └── data.ts
└── backend/
    ├── .env / .env.example
    ├── requirements.txt
    ├── schema.sql
    ├── start-local.sh
    ├── API_CONTRACT.md
    ├── README.md
    └── app/
        ├── main.py              # app FastAPI + CORS + create_all
        ├── core/
        │   ├── config.py        # Settings (variables d'env)
        │   ├── security.py      # hash bcrypt + JWT
        │   └── deps.py          # get_current_user
        ├── db/
        │   ├── base.py
        │   └── session.py       # engine + SessionLocal + get_db
        ├── models/
        │   ├── user.py
        │   ├── project.py
        │   ├── translation.py
        │   ├── subtitle.py
        │   └── setting.py
        ├── schemas/
        │   ├── auth.py
        │   ├── project.py
        │   └── translation.py
        ├── api/v1/
        │   ├── router.py
        │   └── endpoints/
        │       ├── auth.py
        │       └── projects.py
        ├── services/
        │   └── translation.py   # Groq / LibreTranslate / Google
        └── tasks/
            └── process.py       # pipeline + Whisper local CPU + Groq
```

---

## 4. Frontend

### Routes (`src/App.tsx`)

| Route | Page | Accès |
|---|---|---|
| `/login` | Connexion | public |
| `/register` | Inscription | public |
| `/` | Dashboard | JWT requis |
| `/new` | Nouvelle traduction | JWT requis |
| `/processing` | Redirection vers `/new` | JWT requis |
| `/processing/:id` | Suivi du traitement | JWT requis |
| `/result/:id` | Résultat / sous-titres | JWT requis |
| `/history` | Historique | JWT requis |
| `/translations` | Mes traductions (même page que l'historique) | JWT requis |
| `/settings` | Paramètres | JWT requis |
| `*` | Redirection vers `/` | — |

`RequireAuth` vérifie la présence de `vostfr_token` dans `localStorage`.

### Couche API (`src/services/api.ts`)
- `baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'`
- Ajoute automatiquement `Authorization: Bearer <token>`
- Sur réponse `401`, supprime la session et redirige vers `/login`
- Stockage local : `vostfr_token`, `vostfr_user`, `vostfr_theme`

### Design / UI
- Design « iOS premium » dark mode, thème clair disponible via `ThemeContext`
- Tokens CSS dans `:root` (`--bg`, `--violet-*`, `--accent`, `--glass`, `--grad`, etc.)
- Police Inter, cartes en verre (`backdrop-filter`), halos animés, animations `fadeUp`
- Sidebar flottante desktop, barre d'onglets flottante mobile (< 900 px)
- `prefers-reduced-motion` respecté

---

## 5. Backend

### Application (`backend/app/main.py`)
- Crée les tables au démarrage (`Base.metadata.create_all`)
- CORS configuré depuis `CORS_ORIGINS`
- Routes montées sous `/api`
- `GET /` renvoie un état de santé simple

### Authentification
- `POST /api/auth/register` : crée l'utilisateur, hash bcrypt, renvoie un JWT
- `POST /api/auth/login` : vérifie email/mot de passe, renvoie un JWT
- `POST /api/auth/forgot-password` : génère un token aléatoire à usage unique (seule son empreinte SHA-256 est stockée), invalide les anciens liens et envoie l'email (SMTP)
- `POST /api/auth/reset-password` : vérifie le token hashé, son expiration et son usage unique, puis met à jour le mot de passe
- `GET /api/auth/me` : utilisateur courant
- `PUT /api/auth/me` : mise à jour du nom complet
- `POST /api/auth/change-password` : vérifie le mot de passe actuel puis met à jour le hash
- `GET /api/settings` : préférences de traduction et de notifications (créées à la demande)
- `PUT /api/settings` : mise à jour des préférences (`preferred_language`, `translation_preferences`, `notifications`)
- JWT signé avec `SECRET_KEY`, algorithme `HS256`, expiration `ACCESS_TOKEN_EXPIRE_MINUTES`
- Dépendance `get_current_user` : `HTTPBearer` + décodage JWT + lookup en base

### Modèles de données

| Table | Colonnes principales |
|---|---|
| `users` | `id`, `full_name`, `email` (unique), `password_hash`, `created_at` |
| `password_reset_tokens` | `id`, `user_id`, `token_hash` (unique), `expires_at`, `used_at`, `created_at` |
| `projects` | `id`, `user_id`, `title`, `original_filename`, `video_filename`, `duration`, `source_language`, `target_language`, `status`, `progress`, `segments_count`, `created_at`, `completed_at` |
| `subtitles` | `id`, `project_id`, `filename`, `format` (`srt`/`vtt`), `created_at` |

La base ne stocke **que les noms de fichiers** (`video_filename`, `filename`), jamais
les chemins ni les URL. Les chemins disque sont reconstruits par
`app/core/paths.py` à partir de `UPLOAD_DIR`.
| `settings` | `id`, `user_id`, `preferred_language`, `theme`, `translation_preferences` (JSON), `notifications` (JSON) |

Statuts d'un projet : `pending`, `processing`, `completed`, `error`.
Le frontend les affiche en français : « En attente », « En cours », « Terminé », « Erreur ».

### Stockage des fichiers
- Vidéos : `UPLOAD_DIR/videos/`
- Audio temporaire : `UPLOAD_DIR/audios/<project_id>.flac`
- Sous-titres : `UPLOAD_DIR/subtitles/<nom>.<langue>.srt|.vtt`
- Les vidéos ne sont **pas** stockées dans PostgreSQL.

### Endpoints projets (`backend/app/api/v1/endpoints/projects.py`)

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/projects/upload` | Upload multipart d'une vidéo |
| GET | `/api/projects` | Liste des projets de l'utilisateur |
| GET | `/api/projects/{id}` | Détail d'un projet |
| POST | `/api/projects/{id}/translate` | Lance le job en arrière-plan |
| GET | `/api/projects/{id}/progress` | Statut + progression |
| GET | `/api/projects/{id}/subtitles` | Segments de sous-titres |
| GET | `/api/projects/{id}/download?format=srt\|vtt` | Téléchargement |
| DELETE | `/api/projects/{id}` | Suppression (vidéo + sous-titres + audio) |

Toutes les routes `/api/projects` exigent `Authorization: Bearer <token>`.

---

## 6. Pipeline de traitement

Fichier central : `backend/app/tasks/process.py` → `process_project()` (ligne 206).

Étapes et progression :

| Progression | Étape |
|---|---|
| 10 % | Démarrage, statut `processing` |
| 20 % | Lecture de la durée via `ffprobe` |
| 40 % | Extraction audio FFmpeg |
| 50 % | Transcription terminée |
| 50 → 70 % | Traduction par lots |
| 70 % | Écriture des fichiers SRT/VTT |
| 100 % | Statut `completed`, `completed_at` renseigné |

En cas d'exception : rollback, statut `error`, progression remise à 0, audio temporaire supprimé.

### Rétention et suppression automatique

Fichier : `backend/app/tasks/cleanup.py`. La tâche `run_cleanup_task()` est lancée
par une boucle asyncio au démarrage de l'API (`app/main.py`), toutes les
`CLEANUP_INTERVAL_MINUTES` minutes. Elle regroupe deux nettoyages :

- `cleanup_expired_projects()` : un projet `completed` dont `completed_at` dépasse
   `FILE_RETENTION_HOURS` (2 h par défaut) est supprimé intégralement : vidéo source,
  fichiers SRT/VTT, audio temporaire et entrée en base (disparition de l'historique).
  Les projets `completed` antérieurs sans `completed_at` utilisent `created_at`.
  `FILE_RETENTION_HOURS=0` désactive ce nettoyage.
- `cleanup_orphan_files()` : supprime les vidéos et sous-titres présents sur le disque
  mais absents de la base, après `ORPHAN_FILE_GRACE_MINUTES` (60 min) pour ne pas
  toucher à un upload en cours.

La colonne `completed_at` est ajoutée automatiquement au démarrage (`ALTER TABLE
... ADD COLUMN IF NOT EXISTS`) et figure dans `backend/schema.sql`.

### Extraction audio
`extract_audio()` (ligne 61) :

```bash
ffmpeg -y -i <video> -vn -acodec flac -ar 16000 -ac 1 <audio>.flac
```

- FLAC, 16 kHz, mono
- Format accepté à la fois par Groq (en ligne) et par Faster-Whisper (local)

---

## 7. Transcription

Deux fournisseurs, sélectionnés par `TRANSCRIPTION_PROVIDER` :

| Valeur | Comportement |
|---|---|
| `groq` (défaut) | Transcription en ligne via l'API Groq |
| `local` | Transcription locale avec Faster-Whisper sur **CPU** |

Fonction aiguillage : `transcribe_segments()` (ligne 171).

```python
def transcribe_segments(audio_path, language=None):
    if (settings.TRANSCRIPTION_PROVIDER or "").lower() == "groq" and settings.GROQ_API_KEY:
        return transcribe_segments_groq(audio_path, language)
    if (settings.TRANSCRIPTION_PROVIDER or "").lower() == "groq":
        logger.warning("GROQ_API_KEY absent : repli sur Whisper local (CPU)")
    return transcribe_segments_local(audio_path)
```

> **Important** : si `TRANSCRIPTION_PROVIDER=groq` mais que `GROQ_API_KEY` est vide,
> le backend bascule automatiquement sur **Whisper local CPU**. C'est la cause la plus
> fréquente d'un traitement lent.

### 7.1 Transcription en ligne — Groq

Fonctions : `_groq_transcribe_file()` (ligne 83), `_split_audio()` (ligne 122),
`transcribe_segments_groq()` (ligne 151).

- Endpoint : `POST https://api.groq.com/openai/v1/audio/transcriptions`
- Modèle par défaut : `whisper-large-v3-turbo`
- `response_format=verbose_json` pour récupérer les segments avec timestamps
- Langue transmise si différente de `auto`
- Fichiers > `GROQ_MAX_AUDIO_BYTES` (24 Mo) découpés en morceaux de
  `GROQ_AUDIO_CHUNK_SECONDS` (600 s) via FFmpeg, avec décalage des timestamps
- Les morceaux temporaires sont supprimés après usage
- Limite Groq : 25 Mo par requête en offre gratuite

### 7.2 Transcription locale — Whisper sur CPU (détail)

C'est le mode **100 % local, sans GPU, sans API externe**.

#### Code exact

`backend/app/tasks/process.py:75`

```python
def transcribe_segments_local(audio_path: str) -> list[tuple[str, float, float]]:
    from faster_whisper import WhisperModel

    model = WhisperModel(settings.WHISPER_MODEL, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path, beam_size=5)
    return [(segment.text.strip(), segment.start, segment.end) for segment in segments]
```

Points clés :

| Paramètre | Valeur | Signification |
|---|---|---|
| `device` | `"cpu"` | Force le calcul sur le processeur (jamais de GPU) |
| `compute_type` | `"int8"` | Quantification 8 bits : beaucoup moins de RAM, plus rapide sur CPU |
| `settings.WHISPER_MODEL` | `"small"` par défaut | Taille du modèle Faster-Whisper |
| `beam_size` | `5` | Recherche par faisceau : meilleure précision, un peu plus lent |
| Langue | non transmise | Whisper détecte automatiquement la langue |

Le modèle est instancié **à chaque appel** (pas de cache global). Pour un traitement
répété, cela signifie un rechargement du modèle à chaque projet.

#### Quand est-il utilisé ?

1. `TRANSCRIPTION_PROVIDER=local` (forcé)
2. `TRANSCRIPTION_PROVIDER=groq` **et** `GROQ_API_KEY` vide (repli automatique)

#### Modèles disponibles (`WHISPER_MODEL`)

| Valeur | Taille approx. | RAM indicative | Vitesse CPU | Qualité |
|---|---|---|---|---|
| `tiny` | ~75 Mo | ~1 Go | très rapide | faible |
| `base` | ~145 Mo | ~1,5 Go | rapide | correcte |
| `small` | ~480 Mo | ~2 Go | moyenne | bonne (défaut) |
| `medium` | ~1,5 Go | ~5 Go | lente | très bonne |
| `large-v3` | ~3 Go | ~10 Go | très lente | excellente |
| `distil-large-v3` | ~1,5 Go | ~5 Go | plus rapide que large | très bonne |

> Les modèles sont téléchargés automatiquement depuis Hugging Face au premier usage
> (cache dans `~/.cache/huggingface`). Le premier lancement peut donc être long.

#### Ce que fait concrètement le mode local

1. Reçoit le fichier `.flac` extrait (16 kHz mono).
2. Charge le modèle Faster-Whisper (CTranslate2) en mémoire.
3. Décode l'audio avec PyAV.
4. Détecte la langue et transcrit en segments horodatés.
5. Renvoie une liste `(texte, début, fin)`.
6. Le fichier audio temporaire est supprimé à la fin du pipeline.

#### Différences avec Groq

| Critère | Whisper local CPU | Groq |
|---|---|---|
| GPU | jamais | non (calcul distant) |
| Réseau | aucun | obligatoire |
| Clé API | aucune | `GROQ_API_KEY` |
| Vitesse | lente (temps réel ×1 à ×5 selon CPU/modèle) | très rapide |
| Découpage des longues vidéos | non, tout le fichier en une passe | oui, chunks de 10 min |
| Langue | détection automatique | paramétrable |
| Coût | gratuit | gratuit (offre limitée) |
| Confidentialité | totale (local) | audio envoyé à Groq |

#### Performances et limites du CPU

- Sur un CPU récent, `small` tourne souvent autour de **1× à 3× le temps réel**
  (un film de 90 min peut prendre de 30 min à 1 h 30).
- `int8` réduit fortement la RAM mais peut légèrement baisser la précision.
- Pas de découpage : un très long fichier est chargé et traité d'un bloc.
- Pas de `vad_filter` activé : les silences sont traités comme du contenu.
- Pas de `cpu_threads` personnalisé : CTranslate2 utilise ses valeurs par défaut.
- Le modèle n'est pas mis en cache entre les projets.

#### Forcer le mode local

Dans `backend/.env` :

```env
TRANSCRIPTION_PROVIDER=local
WHISPER_MODEL=small
```

Puis redémarrer le backend. `GROQ_API_KEY` peut rester vide.

#### Changer de modèle

```env
WHISPER_MODEL=medium     # meilleure qualité, plus lent / plus de RAM
WHISPER_MODEL=base       # plus rapide, qualité moindre
WHISPER_MODEL=large-v3   # qualité maximale, très lourd sur CPU
```

#### Pistes d'optimisation du mode local (non implémentées)

Si le mode local doit devenir le mode principal, les améliorations utiles seraient :

```python
model = WhisperModel(
    settings.WHISPER_MODEL,
    device="cpu",
    compute_type="int8",
    cpu_threads=os.cpu_count(),   # utiliser tous les cœurs
    num_workers=2,
)
segments, info = model.transcribe(
    audio_path,
    beam_size=5,
    vad_filter=True,              # ignorer les silences
    language=language or None,    # éviter la détection si connue
)
```

Autres pistes :
- Mettre le modèle en cache (singleton) pour éviter les rechargements.
- Découper les longues vidéos en morceaux comme pour Groq.
- Passer `beam_size=1` pour accélérer (au prix de la précision).
- Utiliser `distil-large-v3` comme compromis qualité/vitesse.
- Exécuter la transcription dans un vrai worker (Celery/RQ) plutôt que `BackgroundTasks`.

#### Dépendances du mode local

Dans `backend/requirements.txt` :
- `faster-whisper==1.1.0`
- CTranslate2, PyAV, ONNX Runtime (installés comme dépendances)
- FFmpeg/ffprobe présents dans le `PATH`

Aucune dépendance CUDA n'est nécessaire puisque `device="cpu"`.

#### Dépannage

| Symptôme | Cause probable |
|---|---|
| Traitement très lent | `GROQ_API_KEY` vide → repli local ; ou modèle trop gros |
| `WhisperModel` introuvable | dépendances non installées dans le venv |
| Erreur au premier lancement | téléchargement du modèle en cours |
| RAM saturée | modèle `medium`/`large-v3` sur machine limitée |
| Transcription vide | audio muet ou piste audio absente |
| FFmpeg introuvable | FFmpeg non installé / absent du `PATH` |

---

## 8. Traduction

Fichier : `backend/app/services/translation.py`.

Fournisseur choisi par `TRANSLATION_PROVIDER` :

| Valeur | Service | Clé requise |
|---|---|---|
| `groq` (défaut) | LLM Groq (`openai/gpt-oss-120b`) | `GROQ_API_KEY` |
| `libretranslate` | API compatible LibreTranslate | `TRANSLATION_API_URL` (+ clé optionnelle) |
| `google` | Endpoint Google gratuit non officiel | aucune |

### Traduction Groq (`_translate_groq`, ligne 48)
- Traduit **par lots** (max 40 segments ou ~3000 caractères par requête)
- Prompt système dédié aux sous-titres (ordre, nombre de lignes, noms propres, registre)
- Réponse JSON `{"translations": [...]}`
- En cas d'échec : repli automatique sur Google, puis conservation du texte original
- La progression est mise à jour via un callback `on_progress` (50 → 70 %)

### Repli
- `TRANSLATION_PROVIDER=groq` sans clé → Google
- `libretranslate` sans URL → Google
- Échec d'un lot Groq → Google pour la suite
- Échec d'un segment → texte original conservé

---

## 9. Génération des sous-titres

Fonctions `write_srt()` (ligne 181) et `write_vtt()` (ligne 193).

- `SRT` : `HH:MM:SS,mmm` + numéro de séquence
- `VTT` : en-tête `WEBVTT`, timestamps avec `.` au lieu de `,`
- Le texte traduit est utilisé, sinon le texte original
- Les deux fichiers sont enregistrés sur disque **et** en base (`subtitles.content`)
- Nom : `<nom_video>.<langue_cible>.srt|.vtt`

---

## 10. Variables d'environnement

### Frontend (`.env` à la racine)

| Variable | Défaut | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | URL du backend FastAPI |

### Backend (`backend/.env`)

| Variable | Défaut | Description |
|---|---|---|
| `DATABASE_URL` | — | URL PostgreSQL (`postgresql+psycopg://...`) |
| `SECRET_KEY` | `change-me` | Clé de signature JWT (à changer) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | Durée de vie du JWT (7 jours) |
| `ALGORITHM` | `HS256` | Algorithme JWT |
| `UPLOAD_DIR` | `./storage` | Dossier des vidéos/audio/sous-titres |
| `MAX_UPLOAD_SIZE` | `10737418240` | Taille max d'upload (10 Go) |
| `FILE_RETENTION_HOURS` | `2` | Suppression auto (vidéo + sous-titres + entrée) après génération ; `0` = désactivé |
| `CLEANUP_INTERVAL_MINUTES` | `10` | Fréquence de la tâche de nettoyage |
| `ORPHAN_FILE_GRACE_MINUTES` | `60` | Délai avant suppression d'un fichier disque absent de la base |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Origines autorisées |
| `TRANSCRIPTION_PROVIDER` | `groq` | `groq` ou `local` |
| `TRANSLATION_PROVIDER` | `groq` | `groq`, `libretranslate` ou `google` |
| `WHISPER_MODEL` | `small` | Modèle Faster-Whisper local |
| `GROQ_API_KEY` | *(vide)* | Clé API Groq |
| `GROQ_API_BASE` | `https://api.groq.com/openai/v1` | Base API Groq |
| `GROQ_WHISPER_MODEL` | `whisper-large-v3-turbo` | Modèle de transcription Groq |
| `GROQ_TRANSLATION_MODEL` | `openai/gpt-oss-120b` | Modèle de traduction Groq |
| `GROQ_MAX_AUDIO_BYTES` | `25165824` | Taille max avant découpage (24 Mo) |
| `GROQ_AUDIO_CHUNK_SECONDS` | `600` | Durée des morceaux audio (10 min) |
| `TRANSLATION_API_URL` | *(vide)* | URL LibreTranslate |
| `TRANSLATION_API_KEY` | *(vide)* | Clé LibreTranslate |
| `FRONTEND_URL` | `http://localhost:5173` | Base des liens de réinitialisation envoyés par email |
| `PASSWORD_RESET_EXPIRE_MINUTES` | `30` | Durée de validité du lien de réinitialisation |
| `EXPOSE_RESET_URL` | `false` | Renvoie le lien de reset dans l'API sans SMTP (dev uniquement) |
| `SMTP_HOST` | *(vide)* | Serveur SMTP (vide = lien écrit dans les logs backend) |
| `SMTP_PORT` | `587` | Port SMTP |
| `SMTP_USER` | *(vide)* | Identifiant SMTP |
| `SMTP_PASSWORD` | *(vide)* | Mot de passe SMTP |
| `SMTP_FROM` | `no-reply@vostfr.ai` | Expéditeur des emails |
| `SMTP_TLS` | `true` | Active STARTTLS |

> Ne jamais committer les vraies valeurs de `SECRET_KEY`, `GROQ_API_KEY` ou du mot de passe
> PostgreSQL. Utiliser `.env` local et `.env.example` comme modèle.

---

## 11. Démarrage local

### Frontend

```bash
cd vostfr-ai
npm install
npm run dev        # http://localhost:5173
npm run build      # build de production
```

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # renseigner DATABASE_URL, SECRET_KEY, GROQ_API_KEY...
./start-local.sh
```

`start-local.sh` :
- démarre PostgreSQL local sur le port **5433** (données dans `backend/.pgdata`) ;
- évite de relancer le backend s'il tourne déjà ;
- lance `uvicorn app.main:app --reload --port 8000`.

- API : <http://localhost:8000>
- Swagger : <http://localhost:8000/docs>

### Base de données

```bash
createdb vostfr_ai
psql -d vostfr_ai -f schema.sql
```

Le schéma est non destructif (`CREATE TABLE IF NOT EXISTS`) et peut être rejoué.

---

## 12. Sécurité

- Mots de passe hashés avec bcrypt (`passlib`)
- JWT signé `HS256`, expiration configurable
- Routes projets filtrées par `user_id` (un utilisateur ne voit que ses projets)
- Fichiers média hors base de données
- CORS restreint aux origines configurées
- Aucune clé IA exposée côté frontend : tous les appels externes partent du backend

Points à renforcer en production :
- Changer `SECRET_KEY` et le mot de passe PostgreSQL
- Servir le frontend en HTTPS
- Utiliser un vrai worker de tâches (Celery/RQ) au lieu de `BackgroundTasks`
- Ajouter une limite de débit sur l'authentification
- Valider plus strictement les types MIME et tailles des fichiers

---

## 13. Limites connues

- Traitement synchrone dans le processus FastAPI (`BackgroundTasks`) : un redémarrage
  interrompt les jobs en cours.
- Pas de cache du modèle Whisper local : rechargement à chaque projet.
- Pas de découpage en mode local : les très longues vidéos peuvent saturer la RAM.
- Le mode local ne transmet pas la langue détectée à Whisper (détection automatique).
- Google Translate repose sur un endpoint non officiel (rate-limit possible).
- Le frontend utilise `localStorage` pour le token (pas de refresh token).
- `npm run build` affiche un avertissement de taille de bundle (> 500 kB) ; ce n'est
  pas une erreur.

---

## 14. Résumé du choix transcription

| Besoin | Réglage recommandé |
|---|---|
| Rapide, gratuit, sans GPU | `TRANSCRIPTION_PROVIDER=groq` + `GROQ_API_KEY` |
| 100 % local, aucune API | `TRANSCRIPTION_PROVIDER=local` + `WHISPER_MODEL=small` |
| Local plus rapide | `WHISPER_MODEL=base` ou `distil-large-v3` |
| Local meilleure qualité | `WHISPER_MODEL=medium` ou `large-v3` |
| Machine faible | `WHISPER_MODEL=tiny` ou `base`, `compute_type=int8` |

Le mode par défaut du projet est **Groq en ligne**. Le mode **Whisper local CPU** reste
disponible à tout moment, sans GPU, en changeant une seule variable d'environnement.
