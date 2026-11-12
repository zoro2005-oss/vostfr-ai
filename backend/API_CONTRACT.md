# Contrat d’intégration FastAPI

Le frontend attend un backend externe configuré avec `VITE_API_URL`.

| Méthode | Route | Usage |
|---|---|---|
| POST | `/api/auth/register` | Création de compte |
| POST | `/api/auth/login` | Connexion et JWT |
| GET | `/api/auth/me` | Utilisateur courant |
| POST | `/api/projects/upload` | Upload multipart vidéo |
| GET | `/api/projects` | Liste des projets |
| GET | `/api/projects/{id}` | Détail projet |
| POST | `/api/projects/{id}/translate` | Lance un job de traduction |
| GET | `/api/projects/{id}/progress` | Progression du job |
| GET | `/api/projects/{id}/subtitles` | Segments de sous-titres |
| GET | `/api/projects/{id}/download` | Téléchargement SRT/VTT |
| DELETE | `/api/projects/{id}` | Suppression projet |

Stack backend recommandée : FastAPI, SQLAlchemy, PostgreSQL, Faster-Whisper et FFmpeg. Utiliser un worker asynchrone pour les traitements longs et conserver les fichiers média dans un stockage disque ou objet séparé de PostgreSQL.
