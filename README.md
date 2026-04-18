# OTP Hora — Backend API

API d'authentification **Otp Hora** : les applications partenaires (réseaux sociaux, apps tierces) authentifient leurs utilisateurs en s'intégrant avec Hora. L'utilisateur approuve ou refuse la liaison depuis l'application Hora (web aujourd'hui, mobile à venir).

Ce dépôt contient le **backend Node.js** (Express + PostgreSQL + Prisma). Spécification fonctionnelle : [`PROJECT_SPEC.md`](./PROJECT_SPEC.md).

---

## Sommaire

- [Workflow d'authentification](#workflow-dauthentification)
- [Stack technique](#stack-technique)
- [Installation](#installation)
- [Configuration](#configuration)
- [Base de données](#base-de-données)
- [Démarrage](#démarrage)
- [Endpoints](#endpoints)
- [Structure du projet](#structure-du-projet)
- [Tests API (Postman)](#tests-api-postman)
- [Déploiement](#déploiement)
- [Sécurité](#sécurité)

---

## Workflow d'authentification

### Acteurs

- **Utilisateur Hora** : possède un compte Hora. À l'inscription, Hora lui attribue une **`user_key`** humainement lisible (ex : `x-th-a1b2c3`). Il communique cette clé aux applications partenaires qui veulent l'authentifier.
- **Entreprise (application partenaire)** : possède un compte Hora entreprise. À l'inscription, Hora lui attribue une **`x-api-key`** qu'elle garde secrète dans son `.env`.

### Scénario

1. L'utilisateur ouvre l'application partenaire (Ngoni, etc.) et saisit sa `user_key`.
2. Le partenaire appelle **`POST /api/links`** avec son `x-api-key` et la `user_key` de l'utilisateur. Hora crée (ou retrouve) une liaison en statut `pending` et retourne une **`consent_url`**.
3. Le partenaire redirige l'utilisateur vers la `consent_url`. L'utilisateur arrive sur l'app Hora (web ou mobile), se connecte avec son téléphone + PIN, et voit : *« {Partenaire} demande à vous authentifier. Autoriser ? »*
4. L'utilisateur **approuve** → le statut passe à `approved`. Il **refuse** → statut `rejected`.
5. Le partenaire **poll** la liaison via **`GET /api/links/:link_id`** (ou rappelle `POST /api/links` — c'est idempotent) :
   - `approved` → laisse l'utilisateur se connecter / finaliser son inscription.
   - `rejected` → refuse l'authentification.
   - `pending` → continue de poll.

### Cas particulier : reprise après refus

Si l'utilisateur refuse par erreur, il peut supprimer sa liaison via **`DELETE /api/me/links/:link_id`** (liaison en `rejected` uniquement). Le partenaire pourra ensuite recréer une liaison via `POST /api/links`.

---

## Stack technique

| Composant | Détail |
|-----------|--------|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Base | PostgreSQL |
| ORM | Prisma 7 |
| Auth | `x-api-key` (B2B) pour les entreprises, JWT `role: user` pour les utilisateurs, JWT `role: company` pour l'app entreprise. Téléphones normalisés en E.164 via `libphonenumber-js`. |

---

## Installation

```bash
git clone <url-du-depot>
cd otp-hora-backend-api
npm install
cp .env.example .env
# éditer .env (voir Configuration)
```

---

## Configuration

Variables principales (voir `.env.example` pour la liste complète) :

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` ou `production` |
| `PORT` | Port HTTP (défaut : `3000`) |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL |
| `PUBLIC_HORA_URL` | URL publique du backend Hora (Render). Ex : `https://otp-hora.onrender.com` |
| `PUBLIC_WEB_URL` | URL publique du frontend web Hora (Vercel). Base des `consent_url` retournées. Ex : `https://otp-hora-web.vercel.app` |
| `PUBLIC_APP_URL` | URL publique côté utilisateur (liens dans les emails) |
| `API_KEY_ENCRYPTION_KEY` | Secret pour chiffrer les `api_key` entreprise en AES-256-GCM (retrieval dashboard). **Ne jamais changer** après déploiement. |
| `FLOW_STATE_SECRET` | Secret JWT pour les formulaires `/flow/consent` (anti-CSRF) |
| `FLOW_STATE_TTL_SECONDS` | Durée de vie du state JWT (défaut : 900 sec) |
| `USER_ACCESS_TOKEN_SECRET` / `USER_REFRESH_TOKEN_SECRET` | Secrets JWT utilisateur |
| `USER_ACCESS_TOKEN_TTL_SECONDS` / `USER_REFRESH_TOKEN_TTL_SECONDS` | Durées de vie JWT utilisateur |
| `EMAIL_VERIFICATION_SECRET` / `EMAIL_VERIFICATION_TTL_SECONDS` | Vérification email |
| `PIN_RESET_TOKEN_TTL_MINUTES` | Durée de validité du token de reset PIN |
| `API_KEY_CACHE_TTL_MS` / `API_KEY_CACHE_MAX_ENTRIES` | Cache mémoire des `x-api-key` authentifiées |
| `RATE_LIMIT_*` | Fenêtre et quotas de rate limiting |
| `CORS_ORIGIN` | Optionnel : origines CORS séparées par virgules |

> **Ne jamais commiter le fichier `.env`** — il est listé dans `.gitignore`.

---

## Base de données

Schéma Prisma dans `prisma/schema.prisma`. Modèles principaux : `users` (avec `user_key`), `user_contacts`, `user_devices`, `user_login_history`, `enterprise_accounts`, `enterprise_devices`, `enterprise_login_history`, `identity_links` (status : `pending` / `approved` / `rejected`), `pin_reset_tokens`.

```bash
npx prisma generate
npx prisma migrate deploy
```

Si la base existe sans historique Prisma (`P3005`) :

```bash
npx prisma migrate resolve --applied 20260101000000_baseline_existing_database
npx prisma migrate deploy
```

---

## Démarrage

```bash
npm start        # production
npm run dev      # développement (reload)
```

Healthcheck : `GET /api/health`.

---

## Endpoints

Toutes les routes sont préfixées par `/api`. Le format de réponse est `{ "data": ... }` pour les succès et `{ "error": { "message", "code", "status" } }` pour les erreurs.

### Santé

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Healthcheck |

### Public (pas d'auth, pour la page web de consentement)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/flow/links/:link_id` | Infos publiques d'une liaison (pour affichage sur la page de consentement Vercel) |

### Partenaires (x-api-key ou Bearer entreprise)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/links` | Crée ou récupère la liaison pour une `user_key`. Body : `{ user_key }`. Retourne `{ link_id, status, consent_url, created_at, updated_at }` |
| GET | `/api/links/:link_id` | Statut de la liaison (polling) |
| GET | `/api/enterprises/me/links` | Historique complet des liaisons de l'entreprise (query `?status=...`) |

### Utilisateur (Bearer user)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/me/links` | Liste des liaisons de l'utilisateur connecté (query optionnel : `?status=pending`) |
| POST | `/api/me/links/:link_id/approve` | Approuve une liaison en attente |
| POST | `/api/me/links/:link_id/reject` | Refuse une liaison en attente |
| DELETE | `/api/me/links/:link_id` | Supprime une liaison rejetée (permet au partenaire de réessayer) |

### Compte utilisateur Hora

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/users` | Inscription (`nom`, `prenom`, `pin`) → retourne `user_key` + tokens |
| POST | `/api/users/login` | Connexion (`phone_number` + `pin`) |
| POST | `/api/users/session/unlock` | Déverrouillage (`refresh_token` + `pin`) |
| POST | `/api/users/refresh-token` | Rotation des tokens |
| POST | `/api/users/logout` | Déconnexion (Bearer) |
| GET | `/api/users/:user_id` | Profil (Bearer, self only) |
| PATCH | `/api/users/:user_id` | Modification `nom` / `pin` (Bearer, self only) |
| DELETE | `/api/users/:user_id` | Suppression (Bearer, self only) |
| GET | `/api/users/me/login-history` | Historique paginé (query `?page=1&limit=50`, max 200) |
| GET | `/api/users/me/user-key` | Afficher sa `user_key` (Bearer) |
| PUT | `/api/users/me/recovery-email` | Email de récupération (Bearer) |
| POST | `/api/users/email/verify` | Vérification email (`token`) |
| POST | `/api/users/pin-recovery/request` | Reset PIN (`contact` + email vérifié) |
| POST | `/api/users/pin-recovery/confirm` | Nouveau PIN (`token` + `pin`) |
| POST | `/api/contacts` | Ajout contact téléphone |
| POST | `/api/devices` | Enregistrement appareil (Bearer) |

### Compte entreprise Hora

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/enterprises/register` | Inscription (nom, téléphone E.164, PIN) → retourne `api_key` **une seule fois** |
| POST | `/api/enterprises/login` | Connexion (téléphone + PIN) |
| POST | `/api/enterprises/session/unlock` | Déverrouillage |
| POST | `/api/enterprises/refresh-token` | Rotation des tokens |
| POST | `/api/enterprises/logout` | Déconnexion (Bearer company) |
| GET | `/api/enterprises/me` | Profil entreprise (Bearer company) |
| PATCH | `/api/enterprises/me` | Modification (Bearer company) |
| DELETE | `/api/enterprises/me` | Suppression logique (Bearer company + PIN) |
| PUT | `/api/enterprises/me/recovery-email` | Email de récupération (Bearer company) |
| POST | `/api/enterprises/email/verify` | Vérification email (`token`) |
| POST | `/api/enterprises/pin-recovery/request` | Reset PIN |
| POST | `/api/enterprises/pin-recovery/confirm` | Nouveau PIN |
| GET | `/api/enterprises/me/devices` | Appareils (Bearer company) |
| POST | `/api/enterprises/me/devices` | Enregistrer appareil (Bearer company) |
| GET | `/api/enterprises/me/linked-users` | Utilisateurs liés approved (Bearer company) |
| GET | `/api/enterprises/me/login-history` | Historique paginé (query `?page=1&limit=50`, max 200) |
| GET | `/api/enterprises/me/api-key` | Afficher sa `api_key` (Bearer company) |
| POST | `/api/enterprises/me/api-key/rotate` | Régénérer une nouvelle `api_key` (invalide l'ancienne) |

### Flow web (pages HTML, pas des endpoints JSON)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/flow/consent?link_id=X` | Page d'approbation (login ou approve/reject selon l'état) |
| POST | `/flow/consent/login` | Soumission du login |
| POST | `/flow/consent/resolve` | Soumission approve/reject |

---

## Structure du projet

```
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── postman/
│   └── Otp-Hora-Backend.postman_collection.json
├── src/
│   ├── app.js                 # Express app (middlewares, routes)
│   ├── server.js              # Entry HTTP
│   ├── webFlow.js             # Pages HTML /flow/consent/*
│   ├── config/                # env, Prisma client
│   ├── common/                # auth, errors, logger, userKey, phone, etc.
│   └── modules/
│       ├── health/
│       ├── users/
│       ├── enterprise_accounts/
│       ├── identity_links/    # liaisons (pending / approved / rejected)
│       ├── pin_recovery/
│       ├── user_contacts/
│       └── user_devices/
├── .env.example
├── PROJECT_SPEC.md
├── package.json
└── README.md
```

Architecture par module : **controller** (HTTP) → **service** (règles métier) → **repository** (Prisma).

---

## Tests API (Postman)

Collection fournie : `postman/Otp-Hora-Backend.postman_collection.json`.

1. Importer la collection.
2. Créer un environnement avec `base_url` (ex : `http://localhost:3000`) et `api_key` (après `POST /enterprises/register`).
3. Séquence typique :
   - `POST /users` (récupère `user_key` + tokens)
   - `POST /enterprises/register` (récupère `api_key`)
   - `POST /links` avec `x-api-key` + `user_key` → récupère `link_id` + `consent_url`
   - Ouvrir la `consent_url` dans un navigateur → login + approve
   - `GET /links/:link_id` → vérifier que le status est `approved`

---

## Déploiement

1. Définir `NODE_ENV=production` et toutes les variables sur la plateforme (secrets, `DATABASE_URL`, `PUBLIC_HORA_URL`).
2. `npm ci` (`postinstall` exécute `prisma generate`).
3. `npx prisma migrate deploy`.
4. `npm start` (ou `node src/server.js`).
5. Reverse proxy pour TLS et logs centralisés en production.

### Render

- **Build Command** : `npm install`
- **Start Command** : `node src/server.js`
- Définir `DATABASE_URL`, `PUBLIC_HORA_URL=https://otp-hora.onrender.com`, les secrets JWT, etc. dans *Environment*.
- Lancer les migrations via shell Render : `npx prisma migrate deploy`.

---

## Sécurité

- `.env` non commité (listé dans `.gitignore`).
- `api_key` entreprise hashée en bcrypt en base, renvoyée en clair **uniquement à l'inscription**. Rotation manuelle si compromission.
- `user_key` public par design (équivalent d'un identifiant utilisateur), mais ne permet pas l'authentification seul — l'utilisateur doit toujours approuver depuis Hora.
- Cache API key local au processus (en multi-instances, chaque instance a son propre cache).
- Rate limiting sur les routes sensibles.

---

## Licence

Voir `package.json` (ISC par défaut).
