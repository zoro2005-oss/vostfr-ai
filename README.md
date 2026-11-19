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

## Espace administrateur

L’administration est intégrée au même SPA, dans `admin_ai/`, et est accessible sur :

```
http://localhost:5173/admin_ai
```

Si aucun compte administrateur n’est déjà connecté, l’URL affiche un formulaire de validation réservé aux administrateurs. Il appelle `POST /api/admin/login` : un compte utilisateur classique est refusé côté serveur (403), même avec de bons identifiants. Après validation, le JWT est enregistré dans la session et la navigation affichée dépend des permissions renvoyées par `/api/admin/me`.

Toutes les données affichées sont réelles : utilisateurs, abonnements, transactions, crédits, générations, journaux d’audit, tickets, notifications, langues, moteurs IA, paramètres et surveillance technique. Les actions sensibles (suppression, remboursement, révocation de sessions, attribution de rôles) demandent une confirmation et sont journalisées côté serveur.

Pour promouvoir le premier administrateur, définir `ADMIN_EMAIL` dans `backend/.env` avant de démarrer le backend, ou exécuter depuis `backend/` :

```bash
.venv/bin/python seed_admin.py mon.email@exemple.com super_admin
```

Les rôles disponibles sont `super_admin`, `admin`, `finance`, `support` et `tech`. Le détail des permissions et des routes est dans `backend/README.md`.

## Formules d’abonnement

Quatre forfaits sont créés automatiquement au démarrage PostgreSQL et exposés publiquement via `GET /api/plans` :

| Code | Formule | Prix | Détails |
| --- | --- | --- | --- |
| `FREE` | Gratuit | 0 $ | 3 générations / mois, validité 30 jours, vidéos jusqu'à 2 h 30 incluses, puis passage à Premium ; vidéos conservées 2 h |
| `PREMIUM_15` | Premium 15 jours | 7,99 $ (~4 800 FCFA) | 15 générations, 15 jours, sans sauvegarde, aucune limite de durée par vidéo |
| `PREMIUM_30_BACKUP` | Premium 30 jours – 30 générations | 19,99 $ (~12 000 FCFA) | 30 générations, 30 jours, sauvegarde et conservation permanente, aucune limite de durée par vidéo |
| `PREMIUM_30_UNLIMITED` | Premium 30 jours – Illimité | 29,99 $ (~18 000 FCFA) | Aucun quota de nombre, 30 jours, sans sauvegarde, suppression après 15 min, aucune limite de durée par vidéo |

Le seed ne crée les forfaits que s’ils n’existent pas déjà : les modifications faites depuis l’admin sont conservées au redémarrage. Le contrôle de durée est appliqué à l’upload : un compte gratuit ne peut pas envoyer une vidéo de plus de 150 min et reçoit une erreur `402` qui renvoie vers `/abonnement`. Les formules Premium n’ont aucune limite de durée. Le contrôle du quota de génération reste à brancher sur le pipeline.

La page utilisateur `/abonnement` affiche la formule courante (`GET /api/auth/me/subscription`) et les quatre offres. Les boutons de souscription ouvrent un e-mail pré-rempli tant que le paiement en ligne n’est pas intégré.
