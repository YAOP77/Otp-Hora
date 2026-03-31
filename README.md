# OTP Hora — Backend API

API d’authentification sécurisée pour le produit **OTP Hora** : remplacement des codes OTP par une validation via demandes d’authentification et notifications (push prévu côté produit). Ce dépôt contient le **backend Node.js** (Express + PostgreSQL + Prisma).

La spécification fonctionnelle et métier de référence est décrite dans [`PROJECT_SPEC.md`](./PROJECT_SPEC.md).

---

## Sommaire

- [Stack technique](#stack-technique)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Base de données](#base-de-données)
- [Démarrage](#démarrage)
- [Authentification](#authentification)
- [Endpoints principaux](#endpoints-principaux)
- [Structure du projet](#structure-du-projet)
- [Tests API (Postman)](#tests-api-postman)
- [Déploiement](#déploiement)
- [Sécurité](#sécurité)

---

## Stack technique

| Composant   | Détail                          |
|------------|----------------------------------|
| Runtime    | Node.js ≥ 18                     |
| Framework  | Express 4                        |
| Base       | PostgreSQL                       |
| ORM        | Prisma 7                         |
| Auth API   | Clé entreprise (`x-api-key`) pour les routes partenaires ; identité utilisateur gérée côté OTP Hora (sans clé entreprise) |

---

## Prérequis

- [Node.js](https://nodejs.org/) 18 ou supérieur  
- [PostgreSQL](https://www.postgresql.org/) accessible (local ou hébergé)  
- Compte avec droits de création de base / schéma pour les migrations Prisma  

---

## Installation

```bash
git clone <url-du-depot>
cd otp-hora-backend-api
npm install
```

Copier la configuration d’exemple des variables d’environnement :

```bash
cp .env.example .env
```

Éditer `.env` (voir [Configuration](#configuration)).

---

## Configuration

Variables principales (voir aussi `.env.example`) :

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` ou `production` |
| `PORT` | Port d’écoute HTTP (défaut : `3000`) |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL pour Prisma |
| `CORS_ORIGIN` | Optionnel : origines CORS séparées par des virgules |
| `RATE_LIMIT_*` | Fenêtre et quotas pour le rate limiting sur les routes `auth_*` |
| `API_KEY_CACHE_*` | TTL et taille du cache mémoire des authentifications API key réussies |
| `USER_ACCESS_TOKEN_SECRET` | Secret de signature JWT access token utilisateur |
| `USER_REFRESH_TOKEN_SECRET` | Secret de signature JWT refresh token utilisateur |
| `USER_ACCESS_TOKEN_TTL_SECONDS` | Durée de vie access token utilisateur (sec) |
| `USER_REFRESH_TOKEN_TTL_SECONDS` | Durée de vie refresh token utilisateur (sec) |

> **Ne jamais commiter le fichier `.env`** : il est listé dans `.gitignore`.

---

## Base de données

Le schéma Prisma est dans `prisma/schema.prisma`. Les modèles couvrent notamment : `users`, `user_contacts`, `user_devices`, `enterprise_accounts`, `identity_links`, `auth_requests`, `auth_events`, `recovery_methods`.

Générer le client Prisma et appliquer les migrations :

```bash
npx prisma generate
npx prisma migrate deploy
```

Si la base existe déjà sans historique Prisma (`P3005`), marquer la baseline comme déjà appliquée puis déployer :

```bash
npx prisma migrate resolve --applied 20260101000000_baseline_existing_database
npx prisma migrate deploy
```

Pour une base neuve en développement, `npx prisma db push` reste possible.

En développement (création d’une nouvelle migration) :

```bash
npx prisma migrate dev
```

**Création entreprise (V1)** : la route `POST /api/enterprises` est ouverte et génère automatiquement une `api_key` renvoyée une seule fois en clair. Cette clé doit ensuite être envoyée dans `x-api-key` pour les autres routes protégées.

---

## Démarrage

```bash
# production
npm start

# développement (rechargement à chaud)
npm run dev
```

Vérification rapide :

```http
GET /api/health
```

Réponse : texte indiquant que l’API est en ligne.

---

## Authentification

Aligné avec [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) :

- **Identité OTP Hora** : `POST /api/users` (inscription + émission tokens), `POST /api/users/refresh-token`, `POST /api/contacts`, `POST /api/devices`, `POST /api/recovery` — sans `x-api-key` entreprise.
- **Routes utilisateur sensibles** : `GET /api/users/:user_id`, `POST /api/links/confirm`, `POST /api/auth/approve/:id`, `POST /api/auth/reject/:id` — protégées par `Authorization: Bearer <access_token>`.
- **Partenaire entreprise (NGONI)** : `x-api-key` sur les routes consommées par l’intégration serveur (`POST /api/links` demande de liaison, `POST /api/auth/request`, `GET /api/auth/status/:id`, `GET /api/auth/events/:id`). La clé est **hashée (bcrypt)** en base ; la valeur en clair n’est renvoyée **qu’une seule fois** à `POST /api/enterprises` (onboarding partenaire, V1).
- Un **cache mémoire** (configurable) évite de refaire des comparaisons bcrypt à chaque requête pour la même clé entreprise.

```http
x-api-key: <clé API brute>
```

```http
Authorization: Bearer <access_token_utilisateur>
```

---

## Endpoints principaux

Référence détaillée : `PROJECT_SPEC.md`.

### Séparation des responsabilités (qui appelle quoi)

- **Entreprise (NGONI) — intégration serveur (B2B)**  
  Appels réalisés par le backend de l’entreprise avec `x-api-key`.
  - `POST /api/links` : demander une liaison (crée un lien `pending` avec `external_ref`)
  - `POST /api/auth/request` : créer une demande d’auth (nécessite un lien `active`)
  - `GET /api/auth/status/:request_id` : lire le statut
  - `GET /api/auth/events/:request_id` : lire l’historique

- **Utilisateur (OTP Hora) — côté application OTP Hora**  
  Appels réalisés par l’utilisateur (dans cette V1 API, sans `x-api-key`).
  - `POST /api/users` : inscription (nom, prénom, PIN) + émission `access_token` / `refresh_token`
  - `POST /api/users/login` : connexion flexible (phone + PIN)
  - `POST /api/users/refresh-token` : renouveler les tokens utilisateur via `refresh_token`
  - `POST /api/users/logout` : déconnexion (protégée)
  - `GET /api/users/:user_id` : lire le profil OTP Hora (contacts + comptes liés), protégé par bearer token
  - `PATCH /api/users/:user_id` : modifier `nom` et/ou `pin` (protégée, self only)
  - `DELETE /api/users/:user_id` : supprimer son compte (protégée, self only)
  - `POST /api/contacts` : ajouter téléphone
  - `POST /api/devices` : enregistrer appareil
  - `POST /api/recovery` : méthode de récupération
  - `POST /api/links/confirm` : confirmer une liaison (associe `user_id` au `link_id`)
  - `POST /api/auth/approve/:request_id` : accepter une demande (corps : `user_id`)
  - `POST /api/auth/reject/:request_id` : refuser une demande (corps : `user_id`)

- **OTP Hora (service)**  
  - `GET /api/health` : disponibilité du service
  - `POST /api/enterprises` : onboarding partenaire (génère `api_key` en clair une seule fois)

### Tableau récapitulatif

| Méthode | Chemin | Rôle |
|---------|--------|------|
| `GET` | `/api/health` | Vérifie que l’API est disponible |
| `POST` | `/api/enterprises` | Inscrit une entreprise, génère sa clé API, statut initial `valider` (V1, futur: `attente`) |
| `POST` | `/api/users` | Inscription : `nom`, `prenom`, `pin` (4–6 chiffres) → `user_id` ; PIN hashé en base — **sans** clé entreprise (V1 : pas de biométrie API) |
| `POST` | `/api/users/login` | Connexion utilisateur OTP Hora via `phone_number` + `pin` (renvoie tokens) |
| `POST` | `/api/users/refresh-token` | Renouvelle `access_token` + `refresh_token` utilisateur |
| `POST` | `/api/users/logout` | Déconnexion utilisateur (invalidation serveur des tokens via session version) |
| `GET` | `/api/users/:user_id` | Profil utilisateur OTP Hora : nom, prénom, contacts, comptes liés (nombre + liste). `?include_pin_hash=true` pour afficher `pin_hash` |
| `PATCH` | `/api/users/:user_id` | Modifie `nom` et/ou `pin` (route protégée, utilisateur propriétaire) |
| `DELETE` | `/api/users/:user_id` | Supprime son compte OTP Hora (route protégée, utilisateur propriétaire) |
| `POST` | `/api/contacts` | Contact téléphone — **sans** clé entreprise |
| `POST` | `/api/devices` | Appareil — **sans** clé entreprise |
| `POST` | `/api/recovery` | Méthode de récupération — **sans** clé entreprise |
| `POST` | `/api/links` | NGONI demande une liaison (`external_ref`) → lien `pending` — **avec** `x-api-key` |
| `POST` | `/api/links/confirm` | L’utilisateur valide : associe `user_id` au lien → `active` — **sans** clé entreprise |
| `POST` | `/api/auth/request` | Crée une demande d’auth (lien **actif** requis) — **avec** `x-api-key` |
| `GET` | `/api/auth/status/:request_id` | Lit le statut — **avec** `x-api-key` |
| `POST` | `/api/auth/approve/:request_id` | Acceptation utilisateur (corps : `user_id`) — **sans** clé entreprise |
| `POST` | `/api/auth/reject/:request_id` | Refus utilisateur (corps : `user_id`) — **sans** clé entreprise |
| `GET` | `/api/auth/events/:request_id` | Journal des événements — **avec** `x-api-key` |

Les réponses JSON de succès suivent en général le format `{ "data": ... }`. Les erreurs sont unifiées sous `{ "error": { "message", "code", "status" } }`.

---

## Structure du projet

```
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── postman/
│   └── Otp-Hora-Backend.postman_collection.json
├── src/
│   ├── app.js                 # Application Express (middlewares, routes)
│   ├── server.js              # Point d’entrée HTTP
│   ├── config/                # env, Prisma client
│   ├── common/                # logger, erreurs, auth API key, cache, etc.
│   └── modules/               # Par domaine : controller / service / repository
│       ├── users/
│       ├── enterprise_accounts/
│       ├── identity_links/
│       ├── auth_requests/
│       ├── auth_events/
│       ├── recovery_methods/
│       ├── user_contacts/
│       ├── user_devices/
│       └── health/
├── .env.example
├── PROJECT_SPEC.md
├── package.json
└── README.md
```

Architecture cible par module : **controller** (HTTP) → **service** (règles métier) → **repository** (Prisma).

---

## Tests API (Postman)

Une collection Postman est fournie : `postman/Otp-Hora-Backend.postman_collection.json`.

1. Importer la collection dans Postman.  
2. Créer un environnement avec `base_url` et `api_key` (après `POST /enterprises`).  
3. Enchaîner : `POST /users` (tokens) ou `POST /users/login` → `GET /users/:user_id` (vérification profil) → contacts/devices/recovery → `POST /links` (entreprise) → `POST /links/confirm` → `auth/request` → approve/reject (utilisateur) → statut / events (entreprise).

---

## Déploiement

1. Définir `NODE_ENV=production` et toutes les variables nécessaires sur la plateforme (secrets, `DATABASE_URL`).  
2. `npm ci` (ou `npm install --omit=dev` si pas de devDependencies). Le script **`postinstall`** exécute `prisma generate` pour générer le client Prisma (nécessaire pour que l’app démarre).  
3. `npx prisma migrate deploy` puis `npm start`.  
4. Placer un reverse proxy (TLS, limites de débit complémentaires si besoin).  
5. Vérifier les journaux structurés (stdout) et centraliser-les (ELK, Datadog, etc.) en production.

### Render

- **Build Command** : `npm install` (le `postinstall` lance `prisma generate`). Tu peux aussi utiliser `npm install && npm run build` pour forcer la génération.  
- **Start Command** : `node src/server.js` (ou `npm start`).  
- Définir **`DATABASE_URL`** (et les autres variables) dans l’onglet *Environment* avant le déploiement ; exécuter les migrations une fois (shell Render ou job) : `npx prisma migrate deploy`.

---

## Sécurité

- Ne pas exposer `.env` ni les clés API en dépôt.  
- Rotation des clés API côté entreprise si compromission (invalider l’ancienne entrée en base / statut entreprise).  
- Le cache API key est **local au processus** : en multi-instances, chaque instance a son propre cache (comportement attendu).  
- Pour toute évolution majeure, se référer à `PROJECT_SPEC.md` et aux revues de sécurité internes.

---

## Licence

Voir le champ `license` dans `package.json` (par défaut **ISC** si non modifié).

---

## Contact / contribution

Adapter cette section aux pratiques de votre organisation (issue tracker, canal Slack, responsable technique).
