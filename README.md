# VOSTFR AI

Interface SaaS professionnelle de traduction de films et de génération de sous-titres. Le projet est un frontend React + TypeScript + Vite, conçu pour être connecté à un backend Python FastAPI et PostgreSQL indépendant de Supabase.

## Démarrage

```bash
npm install
npm run dev
```

Puis ouvrir l’URL Vite affichée dans le terminal. Pour produire la version de déploiement : `npm run build`.

## Ce qui est inclus

- Tableau de bord premium avec statistiques, graphique et historique.
- Pages connexion et inscription.
- Import vidéo drag-and-drop avec validation MP4/MKV/AVI/MOV/WEBM.
- Configuration langue source/cible, qualité et options de traduction.
- Écran de traitement avec progression animée.
- Résultat avec aperçu de segments et téléchargement réel `.srt` et `.vtt` de démonstration.
- Historique et paramètres.
- Responsive desktop, tablette et mobile.
- `src/services/api.ts` centralise la couche Axios prête pour FastAPI.
- Les données affichées sont signalées comme démonstration tant que le backend n’est pas branché. Aucune clé IA n’est exposée dans le frontend.

## Connexion FastAPI

Définir `VITE_API_URL=http://localhost:8000` dans un fichier `.env`. Les endpoints prévus sont documentés dans `backend/API_CONTRACT.md`. Le backend doit gérer l’authentification JWT, l’upload sur le système de fichiers, les jobs asynchrones Faster-Whisper/FFmpeg, la traduction, puis la génération SRT/VTT. Les vidéos ne doivent pas être stockées en PostgreSQL.
