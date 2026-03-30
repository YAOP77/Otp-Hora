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
| Auth API   | Clé entreprise (`x-api-key`) + bcrypt (hash en base) |

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

> **Ne jamais commiter le fichier `.env`** : il est listé dans `.gitignore`.

---

## Base de données

Le schéma Prisma est dans `prisma/schema.prisma`. Les modèles couvrent notamment : `users`, `user_contacts`, `user_devices`, `enterprise_accounts`, `identity_links`, `auth_requests`, `auth_events`, `recovery_methods`.

Générer le client Prisma et appliquer les migrations :

```bash
npx prisma generate
npx prisma migrate deploy
```

En développement (création d’une nouvelle migration) :

```bash
npx prisma migrate dev
```

**Bootstrap entreprise** : la route `POST /enterprises` exige une clé API d’une entreprise déjà existante. La première entreprise doit donc être créée via un script de seed, une migration SQL ou une insertion manuelle cohérente avec le hash bcrypt stocké en base.

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
GET /health
```

Réponse : texte indiquant que l’API est en ligne.

---

## Authentification

La plupart des routes sensibles exigent l’en-tête :

```http
x-api-key: <clé API brute>
```

- La clé est **hashée (bcrypt)** en base ; la valeur en clair n’est renvoyée **qu’une seule fois** à la création de l’entreprise.  
- Un **cache mémoire** (configurable) évite de refaire des comparaisons bcrypt à chaque requête pour la même clé.  
- Réponses typiques : `401` si l’en-tête est absent, `403` si la clé est invalide ou l’entreprise inactive.

---

## Endpoints principaux

Référence détaillée : `PROJECT_SPEC.md`. Aperçu :

| Méthode | Chemin | Rôle |
|---------|--------|------|
| `GET` | `/health` | Santé du service |
| `POST` | `/enterprises` | Création entreprise (auth requise) |
| `POST` | `/users` | Création utilisateur |
| `POST` | `/contacts` | Contact utilisateur |
| `POST` | `/devices` | Appareil utilisateur |
| `POST` | `/recovery` | Méthode de récupération |
| `POST` | `/links` | Lien identité entreprise ↔ utilisateur |
| `POST` | `/auth/request` | Création demande d’auth |
| `GET` | `/auth/status/:request_id` | Statut de la demande |
| `POST` | `/auth/approve/:request_id` | Approbation |
| `POST` | `/auth/reject/:request_id` | Rejet |
| `GET` | `/auth/events/:request_id` | Journal des événements |

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
2. Créer un environnement avec `base_url` et `api_key`.  
3. Enchaîner les requêtes (création utilisateur → lien → `auth/request`, etc.).

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
