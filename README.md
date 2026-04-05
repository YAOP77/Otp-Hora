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
| Auth API   | JWT utilisateur (`role: user`) et JWT entreprise (`role: company`) ; clé `x-api-key` (B2B) toujours supportée sur les routes partenaires ; normalisation téléphone via `libphonenumber-js` |

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
| `EMAIL_VERIFICATION_SECRET` | Secret JWT pour les liens de vérification d’email |
| `EMAIL_VERIFICATION_TTL_SECONDS` | Durée de validité du lien de vérification d’email |
| `PIN_RESET_TOKEN_TTL_MINUTES` | Durée de validité du token de réinitialisation PIN (défaut 15) |
| `PUBLIC_APP_URL` | Base URL utilisée dans les liens des emails (mock / production) |

> **Ne jamais commiter le fichier `.env`** : il est listé dans `.gitignore`.

---

## Base de données

Le schéma Prisma est dans `prisma/schema.prisma`. Les modèles couvrent notamment : `users` (rôle `user`), `user_contacts`, `user_devices`, `user_login_history`, `enterprise_accounts`, `enterprise_devices`, `enterprise_login_history`, `identity_links`, `auth_requests`, `auth_events`, `recovery_methods`.

Les numéros sont **normalisés en E.164** à l’enregistrement et à la connexion (`libphonenumber-js`). Les contacts créés avant cette règle peuvent nécessiter une **migration de données** ou une nouvelle saisie pour que la connexion par téléphone fonctionne.

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

**Entreprise** : **`POST /api/enterprises/register`** (nom + téléphone international + PIN) génère une `api_key` B2B renvoyée **une seule fois** en clair et des **JWT entreprise**. Les routes partenaires (`/links`, `/auth/*` côté serveur) acceptent **`x-api-key` ou `Authorization: Bearer`** avec un token **entreprise**. Compte fermé : **`DELETE /api/enterprises/me`** (PIN) → suppression logique, liens révoqués.

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

- **Identité OTP Hora** : `POST /api/users` (inscription + émission tokens `role: user` ; pas d’email à l’inscription), `PUT /api/users/me/recovery-email` (email de récupération, authentifié), `POST /api/users/email/verify` (lien de vérification), `POST /api/users/pin-recovery/request` / `confirm` (PIN oublié, **email vérifié obligatoire**), `POST /api/users/refresh-token`, `POST /api/users/session/unlock`, `POST /api/contacts`, **`POST /api/devices` (Bearer obligatoire)** — sans `x-api-key` entreprise.
- **Routes utilisateur sensibles** : `GET /api/users/:user_id`, `GET /api/users/me/login-history`, `POST /api/links/confirm`, `POST /api/auth/approve/:id`, `POST /api/auth/reject/:id` — protégées par `Authorization: Bearer <access_token>`.
- **Compte entreprise (application)** : `POST /api/enterprises/register`, `POST /api/enterprises/login`, `PUT /api/enterprises/me/recovery-email`, `POST /api/enterprises/email/verify`, `POST /api/enterprises/pin-recovery/request` / `confirm` (PIN oublié, **email vérifié obligatoire**), `GET|PATCH|DELETE /api/enterprises/me`, `POST /api/enterprises/logout`, appareils et historique sous `/api/enterprises/me/...` — **Bearer** avec JWT **entreprise** (`role: company`).
- **Partenaire entreprise (intégration serveur)** : sur `POST /api/links`, `POST /api/auth/request`, `GET /api/auth/status/:id`, `GET /api/auth/events/:id`, envoyer soit **`x-api-key`**, soit **`Authorization: Bearer`** avec un **access token entreprise** (même droits métier pour la société authentifiée). La clé API est **hashée (bcrypt)** en base ; la valeur en clair n’est renvoyée **qu’à l’inscription** (`POST /enterprises/register`).
- Un **cache mémoire** (configurable) évite de refaire des comparaisons bcrypt à chaque requête pour la même clé entreprise.

```http
x-api-key: <clé API brute>
```

```http
Authorization: Bearer <access_token>   # utilisateur (role user) ou entreprise (role company) selon la route
```

---

## Endpoints principaux

Référence détaillée : `PROJECT_SPEC.md`.

### Séparation des responsabilités (qui appelle quoi)

- **Entreprise (NGONI) — intégration serveur (B2B)**  
  Appels réalisés par le backend de l’entreprise avec **`x-api-key` ou Bearer token entreprise**.
  - `POST /api/links` : demander une liaison (crée un lien `pending` avec `external_ref`)
  - `POST /api/auth/request` : créer une demande d’auth (nécessite un lien `active`)
  - `GET /api/auth/status/:request_id` : lire le statut
  - `GET /api/auth/events/:request_id` : lire l’historique

- **Entreprise — application (compte téléphone + PIN)**  
  - `POST /api/enterprises/register` : inscription (nom, téléphone E.164, PIN) → JWT + `api_key` B2B
  - `POST /api/enterprises/login` : connexion téléphone + PIN
  - `POST /api/enterprises/session/unlock` : PIN + refresh (réouverture sans login complet)
  - `POST /api/enterprises/refresh-token` : rotation tokens entreprise
  - `GET /api/enterprises/me` : profil, appareils, utilisateurs liés, aperçu historique connexions
  - `PATCH /api/enterprises/me` : mise à jour compte
  - `POST /api/enterprises/logout` : invalider session entreprise
  - `GET/POST /api/enterprises/me/devices`, `GET /api/enterprises/me/login-history`, `GET /api/enterprises/me/linked-users`

- **Utilisateur (OTP Hora) — côté application OTP Hora**  
  Appels réalisés par l’utilisateur (sans `x-api-key` entreprise).
  - `POST /api/users` : inscription (nom, prénom, PIN) + émission `access_token` / `refresh_token`
  - `POST /api/users/login` : connexion flexible (phone + PIN), numéro normalisé en E.164
  - `POST /api/users/session/unlock` : PIN + `refresh_token` (réouverture session)
  - `POST /api/users/refresh-token` : renouveler les tokens utilisateur via `refresh_token`
  - `POST /api/users/logout` : déconnexion (protégée)
  - `GET /api/users/:user_id` : lire le profil OTP Hora (contacts, appareils, comptes liés), protégé par bearer token
  - `GET /api/users/me/login-history` : dernières connexions (max 5)
  - `PATCH /api/users/:user_id` : modifier `nom` et/ou `pin` (protégée, self only)
  - `DELETE /api/users/:user_id` : supprimer son compte (protégée, self only)
  - `POST /api/contacts` : ajouter téléphone (normalisé E.164)
  - `POST /api/devices` : enregistrer appareil (**Bearer utilisateur obligatoire**)
  - `PUT /api/users/me/recovery-email`, `POST /api/users/email/verify`, `POST /api/users/pin-recovery/*` : récupération de compte (voir `PROJECT_SPEC.md`)
  - `POST /api/links/confirm` : confirmer une liaison (associe `user_id` au `link_id`)
  - `POST /api/auth/approve/:request_id` : accepter une demande (corps : `user_id`)
  - `POST /api/auth/reject/:request_id` : refuser une demande (corps : `user_id`)

- **OTP Hora (service)**  
  - `GET /api/health` : disponibilité du service

### Tableau récapitulatif

| Méthode | Chemin | Rôle |
|---------|--------|------|
| `GET` | `/api/health` | Vérifie que l’API est disponible |
| `POST` | `/api/enterprises/register` | Inscription entreprise : nom, téléphone (E.164), PIN → JWT + `api_key` |
| `POST` | `/api/enterprises/login` | Connexion entreprise : téléphone + PIN → JWT |
| `POST` | `/api/enterprises/refresh-token` | Renouvelle les tokens JWT entreprise |
| `POST` | `/api/enterprises/session/unlock` | PIN + refresh token → nouveaux tokens (session verrouillée) |
| `GET` | `/api/enterprises/me` | Profil entreprise (`email`, `email_verified`), appareils, liens, historique |
| `PUT` | `/api/enterprises/me/recovery-email` | Email de récupération entreprise (Bearer) |
| `POST` | `/api/enterprises/email/verify` | Vérifie l’email entreprise (`token` JWT) |
| `POST` | `/api/enterprises/pin-recovery/request` | Reset PIN par téléphone si email vérifié |
| `POST` | `/api/enterprises/pin-recovery/confirm` | Confirme le nouveau PIN entreprise |
| `PATCH` | `/api/enterprises/me` | Met à jour le compte entreprise (nom, téléphone E.164, PIN) — **pas** l’email direct |
| `DELETE` | `/api/enterprises/me` | Suppression logique (body : `pin`) — liens `revoked`, tokens invalidés |
| `POST` | `/api/enterprises/logout` | Déconnexion entreprise (invalidation JWT) |
| `GET` | `/api/enterprises/me/login-history` | Historique connexions entreprise (max 5 entrées formatées) |
| `POST` | `/api/users` | Inscription : `nom`, `prenom`, `pin` (4–6 chiffres) → `user_id` ; PIN hashé en base — **sans** clé entreprise (V1 : pas de biométrie API) |
| `POST` | `/api/users/login` | Connexion utilisateur OTP Hora via `phone_number` + `pin` (renvoie tokens) |
| `POST` | `/api/users/session/unlock` | `refresh_token` + PIN → nouveaux tokens utilisateur |
| `POST` | `/api/users/refresh-token` | Renouvelle `access_token` + `refresh_token` utilisateur |
| `POST` | `/api/users/logout` | Déconnexion utilisateur (invalidation serveur des tokens via session version) |
| `GET` | `/api/users/:user_id` | Profil : nom, prénom, `email`, `email_verified`, contacts, appareils, comptes liés |
| `PUT` | `/api/users/me/recovery-email` | Définit / modifie l’email de récupération (Bearer) — envoi lien de vérification (mock → logs) |
| `POST` | `/api/users/email/verify` | Confirme l’email (`token` JWT du lien) |
| `POST` | `/api/users/pin-recovery/request` | Demande reset PIN par téléphone (`contact`) si email vérifié |
| `POST` | `/api/users/pin-recovery/confirm` | Nouveau PIN (`token` + `pin`) — usage unique |
| `GET` | `/api/users/me/login-history` | Dernières connexions utilisateur (max 5) |
| `PATCH` | `/api/users/:user_id` | Modifie `nom` et/ou `pin` (route protégée, utilisateur propriétaire) |
| `DELETE` | `/api/users/:user_id` | Supprime son compte OTP Hora (route protégée, utilisateur propriétaire) |
| `POST` | `/api/contacts` | Contact téléphone (E.164) — **sans** clé entreprise |
| `POST` | `/api/devices` | Appareil — **Bearer utilisateur obligatoire** |
| `POST` | `/api/links` | NGONI demande une liaison (`external_ref`) → lien `pending` — **avec** `x-api-key` **ou Bearer entreprise** |
| `POST` | `/api/links/confirm` | L’utilisateur valide : associe `user_id` au lien → `active` — **sans** clé entreprise |
| `POST` | `/api/auth/request` | Crée une demande d’auth (lien **actif** requis) — **avec** `x-api-key` ou Bearer entreprise |
| `GET` | `/api/auth/status/:request_id` | Lit le statut — **avec** `x-api-key` ou Bearer entreprise |
| `POST` | `/api/auth/approve/:request_id` | Acceptation utilisateur (corps : `user_id`) — **sans** clé entreprise |
| `POST` | `/api/auth/reject/:request_id` | Refus utilisateur (corps : `user_id`) — **sans** clé entreprise |
| `GET` | `/api/auth/events/:request_id` | Journal des événements — **avec** `x-api-key` ou Bearer entreprise |

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
│       ├── pin_recovery/
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
2. Créer un environnement avec `base_url` et `api_key` (après `POST /enterprises/register`).  
3. Enchaîner : `POST /users` (tokens) ou `POST /users/login` → `GET /users/:user_id` → contacts → **`POST /devices` (Bearer)** → recovery → optionnel `POST /enterprises/register` (tokens entreprise dans les variables `company_*`) → `POST /links` avec `api_key` **ou** Bearer entreprise → `POST /links/confirm` → `auth/request` → approve/reject → statut / events.

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
