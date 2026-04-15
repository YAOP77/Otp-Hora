# Référence API — Backend OTP Hora (Node.js / Express)

Documentation **alignée sur le code** (`src/modules/*/routes.js`, contrôleurs et services).  
**Base path:** toutes les routes listées ci-dessous sont préfixées par **`/api`** (ex. `GET /api/health` → URL complète `https://<host>/api/health`).

**Nombre d’endpoints documentés:** **39** (aucune omission volontaire — inventaire vérifié contre `src/modules/index.js`).

> **Note:** un fichier `src/modules/recovery_methods/recovery.routes.js` définit `POST /recovery`, mais ce routeur **n’est pas enregistré** dans `registerRoutes` — **ce n’est pas** une des 39 APIs exposées.

---

## 1. Enveloppes communes

### 1.1 Succès (JSON)

Typiquement :

- `{ "data": ... }` pour les réponses JSON structurées.
- Certaines routes renvoient aussi des champs racine (`auth`, `api_key`) — voir chaque endpoint.

### 1.2 Erreur (JSON)

Format standard renvoyé par le gestionnaire d’erreurs :

```json
{
  "error": {
    "message": "Message lisible",
    "code": "CODE_ERREUR",
    "status": 400
  }
}
```

- **`code`:** souvent un code métier (`INVALID_INPUT`, `INVALID_TOKEN`, …). Si l’erreur n’a pas de `code` explicite, le serveur peut utiliser `REQUEST_ERROR` (4xx) ou `INTERNAL_ERROR` (5xx) selon le cas.
- **Production:** pour les erreurs **5xx**, le message peut être masqué (`Erreur interne du serveur`).

### 1.3 En-têtes utiles

| En-tête | Usage |
|--------|--------|
| `Content-Type: application/json` | Corps JSON (obligatoire pour les `POST`/`PUT`/`PATCH` avec body) |
| `Authorization: Bearer <access_token>` | JWT utilisateur (`role: user`) ou entreprise (`role: company`) selon la route |
| `x-api-key: <clé>` | Authentification partenaire (certaines routes **entreprise** : voir ci-dessous) |
| `x-device-name` / `X-Device-Name` | Nom d’appareil (optionnel) — sinon dérivé du body `device_name` ou du `User-Agent` |

### 1.4 Règles métier globales

- **Téléphone:** format international valide (normalisation **E.164** côté serveur, ex. `+2250700000000`). Erreur possible : `INVALID_PHONE`.
- **PIN:** **4 à 6 chiffres** (`^\d{4,6}$`). Dans le JSON, le PIN peut être envoyé en **chaîne ou nombre** ; champs acceptés : `pin`, `PIN`, `code_pin`.
- **Alias téléphone (exemples):** `phone_number`, `phone`, `contact` — selon l’endpoint, le code lit un ou plusieurs alias.
- **Limite corps:** JSON ~ **1 MB** (`express.json`).

### 1.5 Authentification « partenaire » (entreprise sur routes `/auth/*`, `/links`)

Middleware `requireEnterpriseAuth` : **`Authorization: Bearer <access_token>`** avec JWT **rôle entreprise** **ou** **`x-api-key`** (clé API bcrypt côté base).

---

## 2. Index des 39 APIs

| # | Méthode | Endpoint | Nom court |
|---|---------|----------|-----------|
| 1 | GET | `/api/health` | Healthcheck |
| 2 | POST | `/api/users` | Inscription utilisateur |
| 3 | POST | `/api/users/login` | Connexion utilisateur |
| 4 | POST | `/api/users/session/unlock` | Déverrouillage session (refresh + PIN) |
| 5 | POST | `/api/users/refresh-token` | Rafraîchissement tokens utilisateur |
| 6 | PUT | `/api/users/me/recovery-email` | Définir email de récupération |
| 7 | POST | `/api/users/email/verify` | Vérifier email (token) |
| 8 | GET | `/api/users/me/login-history` | Historique de connexion utilisateur |
| 9 | POST | `/api/users/logout` | Déconnexion utilisateur |
| 10 | GET | `/api/users/:user_id` | Profil utilisateur |
| 11 | PATCH | `/api/users/:user_id` | Mise à jour utilisateur |
| 12 | DELETE | `/api/users/:user_id` | Suppression compte utilisateur |
| 13 | POST | `/api/enterprises/register` | Inscription entreprise |
| 14 | POST | `/api/enterprises/login` | Connexion entreprise |
| 15 | POST | `/api/enterprises/refresh-token` | Rafraîchissement tokens entreprise |
| 16 | POST | `/api/enterprises/session/unlock` | Déverrouillage session entreprise |
| 17 | PUT | `/api/enterprises/me/recovery-email` | Email récupération entreprise |
| 18 | POST | `/api/enterprises/email/verify` | Vérifier email entreprise |
| 19 | GET | `/api/enterprises/me` | Profil entreprise |
| 20 | PATCH | `/api/enterprises/me` | Mise à jour entreprise |
| 21 | DELETE | `/api/enterprises/me` | Suppression entreprise |
| 22 | POST | `/api/enterprises/logout` | Déconnexion entreprise |
| 23 | GET | `/api/enterprises/me/devices` | Liste appareils entreprise |
| 24 | POST | `/api/enterprises/me/devices` | Enregistrer appareil entreprise |
| 25 | GET | `/api/enterprises/me/linked-users` | Utilisateurs liés |
| 26 | GET | `/api/enterprises/me/login-history` | Historique connexion entreprise |
| 27 | POST | `/api/auth/request` | Créer demande d’auth |
| 28 | GET | `/api/auth/status/:request_id` | Statut demande d’auth |
| 29 | POST | `/api/auth/approve/:request_id` | Approuver demande |
| 30 | POST | `/api/auth/reject/:request_id` | Rejeter demande |
| 31 | GET | `/api/auth/events/:request_id` | Événements liés à la demande |
| 32 | POST | `/api/users/pin-recovery/request` | Demande reset PIN utilisateur |
| 33 | POST | `/api/users/pin-recovery/confirm` | Confirmer reset PIN utilisateur |
| 34 | POST | `/api/enterprises/pin-recovery/request` | Demande reset PIN entreprise |
| 35 | POST | `/api/enterprises/pin-recovery/confirm` | Confirmer reset PIN entreprise |
| 36 | POST | `/api/links` | Demander lien d’identité |
| 37 | POST | `/api/links/confirm` | Confirmer lien d’identité |
| 38 | POST | `/api/contacts` | Créer contact utilisateur |
| 39 | POST | `/api/devices` | Enregistrer appareil utilisateur |

---

## 3. Détail par endpoint

### 3.1 — `GET /api/health`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Description** | Vérifie que l’API répond. |
| **Query / Path** | Aucun |
| **Réponse 200** | `Content-Type: text/plain` — corps : `API is running` |

---

### 3.2 — `POST /api/users` — Inscription utilisateur

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body (JSON)** | `nom` (string, **requis**), `prenom` (string, **requis**), `pin` \| `PIN` \| `code_pin` (**requis**, 4–6 chiffres) |
| **Succès 201** | `{ "data": { user_id, nom, prenom, status, role, email? }, "auth": { access_token, refresh_token, token_type: "Bearer" } }` |
| **Erreurs** | `400` nom/prenom manquants (message métier, code souvent `REQUEST_ERROR`) ; `400` `INVALID_PIN_FORMAT` ; `400` `INVALID_PHONE` si applicable |

**Exemple requête:**

```http
POST /api/users HTTP/1.1
Content-Type: application/json

{"nom":"Yao","prenom":"Pascal","pin":1234}
```

---

### 3.3 — `POST /api/users/login`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | `phone_number` **ou** `phone` **ou** `contact` (string, **requis**) ; `pin` / alias (**requis**) |
| **Succès 200** | `{ "data": { user_id, nom, prenom, status, role }, "auth": { access_token, refresh_token, token_type } }` |
| **Erreurs** | `400` `INVALID_INPUT` (téléphone manquant) ; `400` `INVALID_PIN_FORMAT` ; `401` `INVALID_CREDENTIALS` ; `400` `INVALID_PHONE` |

---

### 3.4 — `POST /api/users/session/unlock`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | `refresh_token` (string, **requis**) ; `pin` (**requis**) |
| **Succès 200** | `{ "data": { access_token, refresh_token, token_type } }` |
| **Erreurs** | `400` `INVALID_INPUT` ; `400` `INVALID_PIN_FORMAT` ; `401` `INVALID_SESSION` \| `INVALID_REFRESH_TOKEN` \| `INVALID_PIN` ; `404` `USER_NOT_FOUND` |

---

### 3.5 — `POST /api/users/refresh-token`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | `refresh_token` (**requis**) |
| **Succès 200** | `{ "data": { access_token, refresh_token, token_type } }` |
| **Erreurs** | `400` `INVALID_INPUT` ; `401` `UNAUTHORIZED` \| `INVALID_REFRESH_TOKEN` |

---

### 3.6 — `PUT /api/users/me/recovery-email`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **utilisateur** |
| **Body** | `email` (string email, **requis**, max 320 car.) — validation **Joi** |
| **Succès 200** | `{ "data": { message, email, email_verified: false } }` |
| **Erreurs** | `400` `VALIDATION_ERROR` ; `401` `UNAUTHORIZED` ; `400` `INVALID_EMAIL` ; `409` `EMAIL_ALREADY_REGISTERED` |

---

### 3.7 — `POST /api/users/email/verify`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | `token` (string, **requis**, min 20 car.) |
| **Succès 200** | `{ "data": { message, email, email_verified } }` |
| **Erreurs** | `400` `VALIDATION_ERROR` ; `400` `INVALID_INPUT` ; `404` `USER_NOT_FOUND` ; `400` `EMAIL_TOKEN_MISMATCH` |

---

### 3.8 — `GET /api/users/me/login-history`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **utilisateur** |
| **Succès 200** | `{ "data": { "login_history": [ { history_id, label, device_name, connected_at } ] } }` |

---

### 3.9 — `POST /api/users/logout`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **utilisateur** |
| **Succès 200** | `{ "data": { "message": "Déconnexion réussie" } }` |
| **Erreurs** | `401` `INVALID_TOKEN` |

---

### 3.10 — `GET /api/users/:user_id`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **utilisateur** |
| **Path** | `user_id` — UUID |
| **Query** | `include_pin_hash` — si **`true`**, le champ `pin_hash` peut être présent dans `data` |
| **Succès 200** | `{ "data": { user_id, nom, prenom, status, role, email, email_verified, contacts, devices, linked_accounts_count, linked_accounts[, pin_hash] } }` |
| **Erreurs** | `400` `INVALID_INPUT` \| `INVALID_UUID` ; `403` `FORBIDDEN` ; `404` `USER_NOT_FOUND` |

---

### 3.11 — `PATCH /api/users/:user_id`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **utilisateur** (le jeton doit correspondre au **même** `user_id`) |
| **Body** | Au moins un parmi : `nom` ; `pin` / alias. **Interdit:** champs `email` ou `recovery_email` (utiliser PUT recovery-email) — `400` `USE_RECOVERY_EMAIL_ENDPOINT`. |
| **Succès 200** | `{ "data": <utilisateur mis à jour> }` |
| **Erreurs** | `400` `INVALID_UUID` ; `403` `FORBIDDEN` ; `400` `INVALID_INPUT` (aucune modif) ; `400` `INVALID_PIN_FORMAT` ; `404` `USER_NOT_FOUND` |

---

### 3.12 — `DELETE /api/users/:user_id`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **utilisateur** (même `user_id`) |
| **Succès 200** | `{ "data": { "deleted": true, "user_id": "..." } }` |
| **Erreurs** | `400` `INVALID_UUID` ; `403` `FORBIDDEN` ; `404` `USER_NOT_FOUND` |

---

### 3.13 — `POST /api/enterprises/register`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | `nom_entreprise` **ou** `nom` (**requis**) ; `pin` (**requis**) ; téléphone : `phone` \| `phone_number` \| `contact` |
| **Succès 201** | `{ "data": { company_id, nom_entreprise, status, phone_e164, role }, "api_key": "<clé en clair une seule fois>", "auth": { access_token, refresh_token, token_type } }` |
| **Erreurs** | `400` `INVALID_INPUT` \| `INVALID_PIN_FORMAT` ; `400` `INVALID_PHONE` ; `409` `PHONE_ALREADY_REGISTERED` |

---

### 3.14 — `POST /api/enterprises/login`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | téléphone (`phone` \| `phone_number` \| `contact`) ; `pin` |
| **Succès 200** | `{ "data": <company>, "auth": { ... } }` |
| **Erreurs** | `401` `INVALID_CREDENTIALS` ; `400` `INVALID_PIN_FORMAT` ; `400` `INVALID_PHONE` |

---

### 3.15 — `POST /api/enterprises/refresh-token`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | `refresh_token` (**requis**, refresh **entreprise**) |
| **Succès 200** | `{ "data": { access_token, refresh_token, token_type } }` |
| **Erreurs** | `400` `INVALID_INPUT` ; `401` `UNAUTHORIZED` \| `INVALID_REFRESH_TOKEN` |

---

### 3.16 — `POST /api/enterprises/session/unlock`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | `refresh_token` ; `pin` |
| **Succès 200** | `{ "data": { access_token, refresh_token, token_type } }` |
| **Erreurs** | `400` `INVALID_INPUT` ; `401` `INVALID_SESSION` \| `INVALID_REFRESH_TOKEN` \| `INVALID_PIN` |

---

### 3.17 — `PUT /api/enterprises/me/recovery-email`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **entreprise** |
| **Body** | `email` (validation Joi) |
| **Succès 200** | `{ "data": { message, email, email_verified: false } }` |
| **Erreurs** | `400` `VALIDATION_ERROR` ; `400` `INVALID_EMAIL` ; `409` `EMAIL_ALREADY_REGISTERED` |

---

### 3.18 — `POST /api/enterprises/email/verify`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | `token` (min 20 car.) |
| **Succès 200** | `{ "data": { message, email, email_verified } }` |
| **Erreurs** | `400` `VALIDATION_ERROR` ; `404` `COMPANY_NOT_FOUND` ; `400` `EMAIL_TOKEN_MISMATCH` |

---

### 3.19 — `GET /api/enterprises/me`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **entreprise** |
| **Succès 200** | `{ "data": <profil entreprise (inclut notamment devices, linked_users, etc.)> }` |
| **Erreurs** | `404` `COMPANY_NOT_FOUND` |

---

### 3.20 — `PATCH /api/enterprises/me`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **entreprise** |
| **Body** | Champs optionnels : `nom_entreprise` \| `nom` ; `phone` \| `phone_number` ; `pin` ; **pas** d’email direct (flux recovery-email) |
| **Succès 200** | `{ "data": <compte mis à jour> }` |
| **Erreurs** | `400` `INVALID_INPUT` (aucune modif) ; `400` `INVALID_PIN_FORMAT` ; `409` `PHONE_ALREADY_REGISTERED` ; `404` `COMPANY_NOT_FOUND` |

---

### 3.21 — `DELETE /api/enterprises/me`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **entreprise** |
| **Body** | `pin` (**requis**, validation Joi `pinFieldSchema`) |
| **Succès 200** | `{ "data": { message, company_id, deleted: true } }` |
| **Erreurs** | `400` `VALIDATION_ERROR` ; `404` `COMPANY_NOT_FOUND` ; `401` `INVALID_PIN` |

---

### 3.22 — `POST /api/enterprises/logout`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **entreprise** |
| **Succès 200** | `{ "data": { "message": "Déconnexion réussie" } }` |

---

### 3.23 — `GET /api/enterprises/me/devices`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **entreprise** |
| **Succès 200** | `{ "data": { "devices": [ ... ] } }` |

---

### 3.24 — `POST /api/enterprises/me/devices`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **entreprise** |
| **Body** | `device_fingerprint` (string **requis**) ; `device_name` optionnel (sinon header / UA) |
| **Succès 201** | `{ "data": <device créé ou mis à jour> }` |

---

### 3.25 — `GET /api/enterprises/me/linked-users`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **entreprise** |
| **Succès 200** | `{ "data": { "linked_users": [ ... ] } }` |

---

### 3.26 — `GET /api/enterprises/me/login-history`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **entreprise** |
| **Succès 200** | `{ "data": { "login_history": [ { history_id, label, device_name, connected_at } ] } }` |

---

### 3.27 — `POST /api/auth/request`

| Champ | Valeur |
|--------|--------|
| **Auth** | `requireEnterpriseAuth` — **Bearer entreprise** **ou** `x-api-key` |
| **Body** | `link_id` (UUID **requis**) |
| **Succès 201** | `{ "data": { request_id, status, expires_at } }` |
| **Erreurs** | `401` `UNAUTHORIZED` ; `429` `RATE_LIMITED` ; `400` `INVALID_INPUT` \| `INVALID_UUID` ; `404` `LINK_NOT_FOUND` ; `403` `FORBIDDEN` ; `409` `LINK_NOT_ACTIVE` |

---

### 3.28 — `GET /api/auth/status/:request_id`

| Champ | Valeur |
|--------|--------|
| **Auth** | `requireEnterpriseAuth` |
| **Path** | `request_id` (UUID) |
| **Succès 200** | `{ "data": { request_id, status, expires_at } }` — si la demande était `pending` mais expirée, `status` renvoyé peut être `expired`. |
| **Erreurs** | `401` `UNAUTHORIZED` ; `400` `INVALID_INPUT` \| `INVALID_UUID` ; `404` `REQUEST_NOT_FOUND` ; `404` `LINK_NOT_FOUND` ; `403` `FORBIDDEN` |

---

### 3.29 — `POST /api/auth/approve/:request_id`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **utilisateur** |
| **Path** | `request_id` (UUID) |
| **Body** | `user_id` (UUID **requis**, doit être **identique** à l’utilisateur du jeton) |
| **Succès 200** | `{ "data": { request_id, status, expires_at } }` |
| **Erreurs** | `403` `FORBIDDEN` (user_id ≠ requester) ; `429` `RATE_LIMITED` ; `400` / `404` comme validation ; `409` `ALREADY_RESOLVED` ; `410` `REQUEST_EXPIRED` |

---

### 3.30 — `POST /api/auth/reject/:request_id`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **utilisateur** |
| **Path / Body** | Idem **approve** |
| **Erreurs** | Même famille que **approve** |

---

### 3.31 — `GET /api/auth/events/:request_id`

| Champ | Valeur |
|--------|--------|
| **Auth** | `requireEnterpriseAuth` |
| **Path** | `request_id` (UUID) |
| **Succès 200** | `{ "data": [ { event_id, request_id, action, created_at }, ... ] }` |
| **Erreurs** | `401` `UNAUTHORIZED` ; `400` `INVALID_INPUT` \| `INVALID_UUID` ; `404` `REQUEST_NOT_FOUND` \| `LINK_NOT_FOUND` ; `403` `FORBIDDEN` |

---

### 3.32 — `POST /api/users/pin-recovery/request`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | Au moins un parmi : `contact`, `phone`, `phone_number` (string ≥ 5 car. après trim — schéma Joi) |
| **Succès 200** | `{ "data": { message, expires_in_minutes } }` (message générique si compte éligible) |
| **Erreurs** | `400` `VALIDATION_ERROR` ; `404` `RECOVERY_NOT_AVAILABLE` ; `403` `RECOVERY_EMAIL_REQUIRED` |

---

### 3.33 — `POST /api/users/pin-recovery/confirm`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | `token` (**requis**) ; `pin` (**requis**) |
| **Succès 200** | `{ "data": { message } }` |
| **Erreurs** | `400` `VALIDATION_ERROR` \| `INVALID_INPUT` \| `INVALID_PIN_FORMAT` ; `400` `INVALID_OR_EXPIRED_RESET_TOKEN` |

---

### 3.34 — `POST /api/enterprises/pin-recovery/request`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | Comme **3.32** |
| **Erreurs** | `404` `RECOVERY_NOT_AVAILABLE` ; `403` `RECOVERY_EMAIL_REQUIRED` |

---

### 3.35 — `POST /api/enterprises/pin-recovery/confirm`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | `token` ; `pin` / alias |
| **Succès 200** | `{ "data": { message } }` |
| **Erreurs** | Comme utilisateur + validation PIN |

---

### 3.36 — `POST /api/links`

| Champ | Valeur |
|--------|--------|
| **Auth** | `requireEnterpriseAuth` |
| **Body** | `external_ref` (string **requis**) |
| **Succès 201** | `{ "data": { link_id, company_id, user_id, external_ref, status } }` |
| **Erreurs** | `401` (message `company_id introuvable...`, code `REQUEST_ERROR` si Error sans code) ; `400` `INVALID_INPUT` ; `409` `LINK_OR_REQUEST_EXISTS` |

---

### 3.37 — `POST /api/links/confirm`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **utilisateur** |
| **Body** | `link_id` (UUID) ; `user_id` (UUID) — doivent correspondre au titulaire du token |
| **Succès 200** | `{ "data": { link_id, company_id, user_id, external_ref, status } }` |
| **Erreurs** | `400` `INVALID_UUID` ; `403` `FORBIDDEN` ; `404` `LINK_NOT_FOUND` \| `USER_NOT_FOUND` ; `409` `LINK_NOT_PENDING` \| `LINK_ALREADY_BOUND` \| `LINK_ALREADY_EXISTS` |

---

### 3.38 — `POST /api/contacts`

| Champ | Valeur |
|--------|--------|
| **Auth** | Aucune |
| **Body** | `user_id` (UUID **requis**) ; `phone_number` (**requis**, normalisé E.164) |
| **Succès 201** | `{ "data": { contact_id, user_id, phone_number, verified_at } }` |
| **Erreurs** | `400` (champs manquants — code souvent `REQUEST_ERROR`) ; `404` (utilisateur introuvable) |

---

### 3.39 — `POST /api/devices`

| Champ | Valeur |
|--------|--------|
| **Auth** | Bearer **utilisateur** |
| **Body** | `device_fingerprint` (**requis**) ; `device_name` optionnel |
| **Succès 201** | `{ "data": { device_id, user_id, device_fingerprint, trusted, device_name, user_agent, last_seen_at } }` |
| **Erreurs** | `400` (fingerprint manquant / contexte) ; `404` (utilisateur) — codes souvent `REQUEST_ERROR` si non renseignés dans l’erreur |

---

## 4. Consommation depuis **Next.js** (consignes agent)

Ces consignes supposent une app Next.js **App Router** (13+) ou **Pages Router** — à adapter au projet cible **sans casser** la structure existante (dossiers `lib/`, `services/`, `hooks/`, etc.).

### 4.1 Configuration

- Stocker l’URL de base dans une variable d’environnement, ex. **`NEXT_PUBLIC_API_BASE_URL`** (côté client) et/ou **`API_BASE_URL`** (côté serveur uniquement si l’API ne doit pas être exposée au navigateur).
- Préfixer toutes les routes par cette base + **`/api`**.

### 4.2 Centraliser les appels

- Créer un **module unique** (ex. `lib/api/client.ts`) qui expose :
  - `buildUrl(path: string)`
  - `apiFetch(path, { method, body, headers, token? })` qui :
    - envoie `Content-Type: application/json` si `body` est un objet ;
    - ajoute `Authorization: Bearer …` quand un token est fourni ;
    - parse la réponse JSON si `Content-Type` l’indique ;
    - pour **`GET /api/health`**, accepter du **texte brut** (pas JSON).
- Ne pas dupliquer la logique `fetch` dans chaque composant.

### 4.3 Où appeler le backend

- **Server Components / Route Handlers / Server Actions:** `fetch` avec URL absolue vers le backend ; utile pour ne pas exposer les clés ou pour BFF.
- **Client Components:** `fetch` vers le backend (si CORS autorise l’origine Next) ou vers des **Route Handlers** Next qui proxyfient vers l’API (si politique stricte).

### 4.4 Gestion des erreurs

- Toujours lire **`error.code`** et **`error.status`** du JSON d’erreur quand présents.
- Distinct :
  - **Réseau** (pas de réponse, timeout) → message générique + retry optionnel ;
  - **HTTP 4xx/5xx** avec corps JSON → erreur métier affichable (`error.message`) ;
  - **429** sur `/auth/request` et approve/reject → backoff / message utilisateur.

### 4.5 Tokens

- Persister **access_token** et **refresh_token** (selon politique de sécurité du front : `memory`, `httpOnly` cookie via BFF, etc.).
- Au **401** sur une route protégée, tenter un **`/users/refresh-token`** ou **`/enterprises/refresh-token`** puis rejouer la requête une fois ; sinon déconnexion propre.

### 4.6 Cohérence avec ce backend

- Respecter les alias (`phone` / `contact`, `pin` / `code_pin`).
- Ne pas envoyer `email` sur `PATCH /users/:user_id` — utiliser **`PUT /users/me/recovery-email`**.
- Pour les routes **`requireEnterpriseAuth`**, implémenter soit **JWT entreprise**, soit **`x-api-key`** selon le cas d’usage (intégration serveur-à-serveur vs dashboard connecté).

---

## 5. Checklist de validation (39 APIs + intégration Next.js)

### 5.1 Documentation / couverture API

- [ ] **1** — `GET /api/health`
- [ ] **2** — `POST /api/users`
- [ ] **3** — `POST /api/users/login`
- [ ] **4** — `POST /api/users/session/unlock`
- [ ] **5** — `POST /api/users/refresh-token`
- [ ] **6** — `PUT /api/users/me/recovery-email`
- [ ] **7** — `POST /api/users/email/verify`
- [ ] **8** — `GET /api/users/me/login-history`
- [ ] **9** — `POST /api/users/logout`
- [ ] **10** — `GET /api/users/:user_id`
- [ ] **11** — `PATCH /api/users/:user_id`
- [ ] **12** — `DELETE /api/users/:user_id`
- [ ] **13** — `POST /api/enterprises/register`
- [ ] **14** — `POST /api/enterprises/login`
- [ ] **15** — `POST /api/enterprises/refresh-token`
- [ ] **16** — `POST /api/enterprises/session/unlock`
- [ ] **17** — `PUT /api/enterprises/me/recovery-email`
- [ ] **18** — `POST /api/enterprises/email/verify`
- [ ] **19** — `GET /api/enterprises/me`
- [ ] **20** — `PATCH /api/enterprises/me`
- [ ] **21** — `DELETE /api/enterprises/me`
- [ ] **22** — `POST /api/enterprises/logout`
- [ ] **23** — `GET /api/enterprises/me/devices`
- [ ] **24** — `POST /api/enterprises/me/devices`
- [ ] **25** — `GET /api/enterprises/me/linked-users`
- [ ] **26** — `GET /api/enterprises/me/login-history`
- [ ] **27** — `POST /api/auth/request`
- [ ] **28** — `GET /api/auth/status/:request_id`
- [ ] **29** — `POST /api/auth/approve/:request_id`
- [ ] **30** — `POST /api/auth/reject/:request_id`
- [ ] **31** — `GET /api/auth/events/:request_id`
- [ ] **32** — `POST /api/users/pin-recovery/request`
- [ ] **33** — `POST /api/users/pin-recovery/confirm`
- [ ] **34** — `POST /api/enterprises/pin-recovery/request`
- [ ] **35** — `POST /api/enterprises/pin-recovery/confirm`
- [ ] **36** — `POST /api/links`
- [ ] **37** — `POST /api/links/confirm`
- [ ] **38** — `POST /api/contacts`
- [ ] **39** — `POST /api/devices`

### 5.2 Intégration Next.js

- [ ] Variable d’environnement base URL configurée et utilisée partout.
- [ ] Appels API centralisés (un client HTTP commun).
- [ ] Gestion des erreurs réseau vs erreurs JSON métier.
- [ ] Rafraîchissement de token ou flux logout sur 401.
- [ ] Aucun endpoint « orphelin » dans le code front (rechercher les chemins `/api/` et comparer à la liste §2).

### 5.3 Vérification fonctionnelle

- [ ] Test manuel ou automatisé : une requête réussie et un cas d’erreur attendu (4xx) par **groupe** (users, enterprises, auth, pin-recovery, links, contacts, devices).
- [ ] Healthcheck (`GET /health`) OK en préproduction.

---

*Document généré à partir du dépôt « Otp Hora Backend Api » — pour toute évolution de contrat, se référer aux fichiers `src/modules/**` et à Prisma.*
