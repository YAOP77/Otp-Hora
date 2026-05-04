## Prompt (à donner à Claude) — Intégration “Hora” comme workflow d’auth Ngoni

Tu es un **Backend Senior Node.js**. Tu dois **remplacer le flux OTP** de Ngoni par un flux d’autorisation basé sur le service externe **OTP Hora**, **sans régression**, en respectant l’architecture micro-services existante.

Ce document est **la source de vérité**. Interdictions strictes :
- **Ne pas inventer** d’endpoint Hora (si ce n’est pas listé ici, il n’existe pas).
- **Ne pas inventer** de mécanisme d’auth (ex : “token dans le body”, “credentials obligatoires dans .env”).
- **Ne pas logger** les tokens (`Authorization`) ni les `x-api-key`.

---

### 1) Objectif produit (très important)

Le workflow Hora ne “crée pas le compte Ngoni”. Il sert à **autoriser** l’accès à l’étape suivante :
- **Si l’utilisateur n’a pas encore de compte Ngoni** : après approbation Hora → on lui ouvre le **formulaire /api/v1/auth/register**.
- **Si l’utilisateur a déjà un compte Ngoni mais n’est pas connecté** : après approbation Hora → on lui ouvre le flux **login Ngoni** (ou on émet une session Ngoni selon l’implémentation).

➡️ **Le workflow Hora remplace OTP (validation)**, pas les routes Ngoni elles-mêmes.

Nouveau point clé (UX/Redirection) :
- **L’entreprise n’est pas “redirigée” vers Hora.** Elle appelle Hora en serveur-à-serveur (auth entreprise) pour créer `link_id` + `request_id`.
- **Seul l’utilisateur** est redirigé/dirigé vers une UI Hora pour donner son consentement.

---

### 2) Authentification vers Hora : règles exactes

Hora distingue deux identités :

#### 2.1 Auth “Entreprise” (partenaire)
Certaines routes Hora acceptent **OU logique** :
- `Authorization: Bearer <COMPANY_ACCESS_TOKEN>`  **(JWT entreprise Hora)**  
OU
- `x-api-key: <HORA_API_KEY>` **(clé API entreprise Hora)**

**Important :**
- Ce n’est **pas** “Bearer obligatoire + x-api-key optionnel”. C’est **un OU**.
- Le Bearer doit être un **token entreprise** (role `company`), pas un token user, pas un refresh token.

#### 2.2 Auth “Utilisateur”
Certaines routes Hora exigent :
- `Authorization: Bearer <USER_ACCESS_TOKEN>` **(JWT user Hora)**

**Interdit :**
- Ne jamais demander/envoyer un `hora_user_token` dans le **body**.  
Tout passe par le header `Authorization`.

#### 2.3 À propos du `.env` / secrets
Ne confonds pas “login interactif” et “secret d’intégration”.

- **Côté entreprise** : il faut un **secret stable** pour identifier l’app partenaire auprès de Hora (**x-api-key** recommandé). Ce n’est pas un “compte connecté dans une UI”, c’est une **clé serveur-à-serveur**.
- Ce secret doit être stocké dans un secret manager (Render/GitHub/AWS/GCP) ou `.env` **côté serveur uniquement** (jamais côté mobile).
- **Côté user** : aucun secret serveur requis. L’utilisateur se connecte via téléphone+PIN (ou via son Bearer user si déjà disponible).

---

### 3) Endpoints Hora : liste exacte (ne pas ajouter d’autres routes)

#### 3.1 Identity links
1) **[ENTREPRISE] Créer une demande de liaison**
- `POST https://otp-hora.onrender.com/api/links`
- Auth : **Entreprise** (Bearer company **ou** `x-api-key`)
- Body :
```json
{ "external_ref": "ext-user-001" }
```
- Réponse 201 (exemple) :
```json
{
  "data": {
    "link_id": "uuid",
    "company_id": "uuid",
    "user_id": null,
    "external_ref": "ext-user-001",
    "status": "pending"
  }
}
```

2) **[USER] Confirmer la liaison**
- `POST https://otp-hora.onrender.com/api/links/confirm`
- Auth : **Utilisateur** (Bearer user)
- Body :
```json
{ "link_id": "uuid", "user_id": "uuid" }
```
- Réponse 200 : status devient `active`.

✅ Contrainte fonctionnelle : le `user_id` du body doit correspondre au user du token (sinon `403 FORBIDDEN`).

**Note critique :**
- Il n’existe **PAS** de `GET /api/links` ni `GET /api/links/:id` dans Hora.
- Donc l’étape “statut de liaison” se gère soit via stockage interne, soit via un essai de `POST /api/auth/request` (erreur `LINK_NOT_ACTIVE`), soit via la UI de consentement (voir §5.2).

#### 3.2 Auth requests (demande d’autorisation)
3) **[ENTREPRISE] Créer une demande d’auth**
- `POST https://otp-hora.onrender.com/api/auth/request`
- Auth : **Entreprise** (Bearer company **ou** `x-api-key`)
- Body :
```json
{ "link_id": "uuid" }
```
- Réponse 201 :
```json
{ "data": { "request_id": "uuid", "status": "pending", "expires_at": "ISO" } }
```

4) **[ENTREPRISE] Lire statut**
- `GET https://otp-hora.onrender.com/api/auth/status/:request_id`
- Auth : **Entreprise** (Bearer company **ou** `x-api-key`)

5) **[USER] Approuver**
- `POST https://otp-hora.onrender.com/api/auth/approve/:request_id`
- Auth : **Utilisateur** (Bearer user)
- Body :
```json
{ "user_id": "uuid" }
```

6) **[USER] Rejeter**
- `POST https://otp-hora.onrender.com/api/auth/reject/:request_id`
- Auth : **Utilisateur** (Bearer user)
- Body :
```json
{ "user_id": "uuid" }
```

#### 3.3 Auth events (audit trail)
7) **[ENTREPRISE] Events**
- `GET https://otp-hora.onrender.com/api/auth/events/:request_id`
- Auth : **Entreprise** (Bearer company **ou** `x-api-key`)
- Renvoie la liste ordonnée d’événements : `created`, `approved`, `rejected` (avec timestamps).

---

### 4) Gérer “le statut de liaison” sans endpoint Hora dédié

Puisqu’il n’existe pas de `GET /api/links` :
- Le backend Ngoni doit **persister** (au minimum) le `link_id`, `external_ref`, `company_id`, `status` (pending/active) au moment de la création.
- Le passage à `active` est connu :
  - soit parce que l’app mobile appelle `POST /links/confirm` via notre proxy et on enregistre la réponse,
  - soit parce que l’entreprise tente `POST /auth/request` et reçoit l’erreur `LINK_NOT_ACTIVE` si la liaison n’est pas confirmée.

➡️ Donc : on peut “poller” côté Ngoni via notre DB (source interne), ou via `auth/request` (source Hora indirecte).

---

### 5) Workflow final attendu (de bout en bout)

#### Inscription/Connexion via Hora (remplacement OTP)
1) L’app Ngoni (entreprise) crée le `link_id` via `POST /api/links` (auth entreprise).
2) Ngoni crée une `auth_request` via `POST /api/auth/request` (auth entreprise).
3) **Ngoni redirige l’utilisateur vers Hora (UI consentement)** avec `link_id` + `request_id` + `callback_url` :
   - `GET https://otp-hora.onrender.com/flow/consent?link_id=...&request_id=...&callback_url=...`
   - Hora utilise un `state` signé en interne pour protéger le flux.
4) Dans la UI Hora, l’utilisateur se connecte (téléphone+PIN), confirme la liaison, puis approuve/rejette la demande.
5) Si `callback_url` est fourni et autorisé, Hora redirige vers :
   - `callback_url?hora_status=approved|rejected&hora_request_id=...&hora_link_id=...`
6) Ngoni suit le statut via `/api/auth/status/:id` + `/api/auth/events/:id` (auth entreprise).
7) Si approuvé :
   - user sans compte Ngoni → autoriser l’accès au formulaire register Ngoni.
   - user existant → autoriser login/session Ngoni.

---

### 6) Tes tâches (livrables obligatoires)

1) **Reprendre l’intégration de 0** en appliquant strictement les endpoints et l’auth ci-dessus.
2) Mettre à jour :
   - le code (services/controllers/routes/validators) pour **ne jamais** lire de token user dans le body,
   - la collection Postman,
   - la documentation interne (README ou doc).
3) Ajouter une section “sécurité” :
   - masquer `Authorization` et `x-api-key` dans les logs,
   - pas de stockage token user,
   - timeouts et retries prudents (pas de retry sur 4xx).
4) Fournir **3 cURL** corrects (sans vrais tokens) :
   - `POST /api/links` (auth entreprise via Bearer OU x-api-key)
   - `POST /api/links/confirm` (auth user Bearer)
   - `GET /api/auth/events/:request_id` (auth entreprise)

5) Documenter la **redirection utilisateur** :
   - URL Hora : `/flow/consent`
   - paramètres : `link_id`, `request_id`, `callback_url`
   - contraintes sécurité : allowlist des origines callback + `state` signé (anti-CSRF)

---

### 7) Critères d’acceptation (pour dire “terminé”)

- Aucune route Hora inventée (`GET /api/links` interdit).
- Aucun token user dans le body (interdit).
- Le proxy relaie correctement les headers et renvoie les erreurs Hora au format `{ error: { message, code, status } }` si présent.
- Le nouveau workflow remplace OTP sans casser les routes Ngoni existantes.

