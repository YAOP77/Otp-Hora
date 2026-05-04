# OTP HORA - SPÉCIFICATION BACKEND (VERSION STRICTE)

## OBJECTIF

Construire une solution d’identité et de validation sécurisée permettant :

- la gestion d’une identité utilisateur unique et stable
- la liaison entre un utilisateur OTP Hora et une entreprise (ex: NGONI)
- l’envoi et le traitement de demandes d’authentification
- la validation utilisateur via application mobile (remplacement OTP)

---

## STACK TECHNIQUE

- Backend : Node.js (Express)
- Base de données : PostgreSQL
- ORM : Prisma
- Notifications : Firebase (utilisé côté application mobile)

---

## CONCEPT CENTRAL

Le système remplace les OTP (SMS / Email) par une validation via application OTP Hora.

### Principe :

1. L’utilisateur possède une identité OTP Hora unique
2. L’entreprise (NGONI) lie son client à cette identité
3. À chaque connexion :
   - NGONI envoie une demande à OTP Hora
   - OTP Hora notifie l’utilisateur
   - L’utilisateur accepte ou refuse
   - NGONI lit le résultat

IMPORTANT :
- L’entreprise ne gère PAS l’identité
- Elle ne fait que consommer l’API

---

## ACTEURS

### Utilisateur
- Crée son compte dans OTP Hora
- Possède une identité unique
- Valide ou refuse les demandes

### OTP Hora
- Gère identités, liens et demandes
- Centralise la logique de validation

### Entreprise (NGONI)
- Envoie les demandes d’authentification
- Lit les statuts

### Administrateur
- Gère sécurité, support et incidents

---

## FLUX FONCTIONNELS

### 1. Inscription utilisateur (OTP Hora)

1. L’utilisateur crée son compte dans OTP Hora
2. OTP Hora crée un `user_id`
3. Ajout des informations :
   - nom
   - prénom
   - téléphone
4. Le compte est lié :
   - au téléphone
   - à l’appareil
5. L’utilisateur configure :
   - PIN ou biométrie (côté produit)

**V1 (ce backend)** : **PIN uniquement** — 4 à 6 chiffres, **jamais stocké en clair** (hash bcrypt dans `users.pin_hash`). Pas de biométrie exposée ni requise par l’API pour cette version.
Après inscription, OTP Hora émet un couple `access_token` / `refresh_token` pour sécuriser les routes sensibles utilisateur.

IMPORTANT :
- Cette étape appartient à OTP Hora (pas à l’entreprise)
- OTP Hora doit permettre la lecture du profil utilisateur pour support et vérification du parcours
  - `GET /users/:user_id` retourne : identité (`nom`, `prenom`), contacts, comptes liés (nombre + liste)
  - `pin_hash` peut être retourné uniquement sur demande explicite (`include_pin_hash=true`) dans ce backend V1

---

### 2. Lien avec une entreprise

1. L’utilisateur se connecte sur NGONI
2. NGONI demande une liaison
3. OTP Hora reçoit la demande
4. L’utilisateur valide
5. OTP Hora crée un lien dans `identity_links`

IMPORTANT :
- NGONI ne stocke QUE `external_ref` + lien OTP Hora
- NGONI ne crée PAS d’utilisateur OTP Hora

---

### 3. Authentification

1. L’utilisateur tente de se connecter sur NGONI
2. NGONI envoie une demande à OTP Hora
3. OTP Hora crée `auth_requests`
4. OTP Hora notifie l’utilisateur
5. L’utilisateur accepte ou refuse
6. OTP Hora met à jour le statut
7. NGONI lit le statut

---

### 4. Récupération

- Gestion via `recovery_methods`
- Permet :
  - récupération compte
  - déblocage
  - validation secondaire

---

## RÈGLES MÉTIER

- Un utilisateur possède une identité unique
- Le numéro peut changer sans casser l’identité
- Un lien unique par entreprise et utilisateur
- Les demandes sont temporaires (expiration)
- Toutes les actions sont journalisées

---

## BASE DE DONNÉES

### users
- user_id
- nom
- prenom
- pin_hash (hash bcrypt du PIN — jamais le PIN en clair)
- token_version (invalidation logout / rotation)
- statut
- role (`user` | valeurs réservées ; défaut `user`)
- email (nullable, unique si renseigné — **pas** à l’inscription ; défini via `PUT /users/me/recovery-email`)
- email_verified_at (nullable ; la réinitialisation PIN par email n’est possible **qu’avec email vérifié**)

### user_contacts
- contact_id
- user_id
- phone_number (stockage **normalisé E.164**, ex. `+2250700000000`)
- verified_at

### user_devices
- device_id
- user_id
- device_fingerprint
- trusted
- device_name, user_agent, last_seen_at (métadonnées appareil)

### user_login_history
- history_id
- user_id
- device_name, user_agent
- connected_at (journal des connexions, affichage limité côté API)

### enterprise_accounts
- company_id
- nom_entreprise
- api_key (hash bcrypt — usage intégration serveur B2B)
- status
- phone_e164 (obligatoire pour login appli entreprise après `POST /enterprises/register`)
- pin_hash (hash bcrypt si téléphone + PIN activés)
- token_version (invalidation logout entreprise)
- deleted_at (suppression **logique** ; entreprise exclue des auth et intégrations)
- email, email_verified_at (récupération PIN ; définition via **PUT /enterprises/me/recovery-email** uniquement)

### enterprise_devices
- device_id
- company_id
- device_fingerprint (unique par entreprise)
- trusted, device_name, user_agent, last_seen_at

### enterprise_login_history
- history_id
- company_id
- device_name, user_agent
- connected_at

### pin_reset_tokens
- reset_id
- user_id
- token_hash (SHA-256 du jeton brut — usage unique, expiration)
- expires_at, used_at

### enterprise_pin_reset_tokens
- reset_id
- company_id
- token_hash
- expires_at, used_at

### identity_links
- link_id
- company_id
- user_id
- external_ref
- status (ex. `pending`, `active`, `revoked` si entreprise supprimée)

### auth_requests
- request_id
- link_id
- status
- expires_at

### auth_events
- event_id
- request_id
- action
- created_at

### recovery_methods (schéma existant — non exposé par une route publique V2)

---

## API ENTREPRISE (STRICT)

### Authentification intégration serveur (B2B)

Les routes consommées par le **backend partenaire** (`POST /links`, `POST /auth/request`, `GET /auth/status/:request_id`, `GET /auth/events/:request_id`) acceptent :

- **`x-api-key`** : clé API hashée (onboarding `POST /enterprises/register`), **ou**
- **`Authorization: Bearer <access_token>`** : JWT émis pour le rôle **`company`** (`POST /enterprises/login` / inscription entreprise).

POST /auth/request  
→ créer une demande  
→ retourne request_id  

GET /auth/status/:request_id  
→ retourne :
- pending
- approved
- rejected

### Application entreprise (compte + PIN)

- **POST /enterprises/register** : `nom_entreprise` (ou `nom`), téléphone international (`phone` / `phone_number`, validé en E.164), `pin` (4–6 chiffres, hash bcrypt). Retourne profil entreprise, **`api_key` brute** (B2B) et couple JWT (`role: company`).
- **POST /enterprises/login** : téléphone + `pin` → JWT entreprise.
- **POST /enterprises/refresh-token** : refresh token entreprise uniquement.
- **POST /enterprises/session/unlock** : `refresh_token` + `pin` → nouveaux tokens (retour utilisateur sans refaire saisie téléphone complète).
- **GET /PATCH /enterprises/me**, **DELETE /enterprises/me** (corps : `pin`) : profil, mise à jour (`nom_entreprise`, `phone`/`phone_number` E.164, `pin`), suppression logique (`deleted_at`, statut `deleted`, liens passés en `revoked`, invalidation JWT).
- **POST /enterprises/logout** : déconnexion (incrément `token_version`).
- **GET /enterprises/me/devices**, **POST /enterprises/me/devices** : liste / enregistrement d’appareils (Bearer entreprise).
- **GET /enterprises/me/linked-users** ou agrégat dans **GET /enterprises/me** : utilisateurs liés (`identity_links` actifs).
- **GET /enterprises/me/login-history** : jusqu’à **5** dernières connexions avec libellé lisible (FR).
- **PUT /enterprises/me/recovery-email**, **POST /enterprises/email/verify**, **POST /enterprises/pin-recovery/request|confirm** : voir section « Récupération de compte » (entreprise).

---

## RÉCUPÉRATION DE COMPTE (PIN OUBLIÉ)

Règle **stricte** : sans **email vérifié** (`email_verified_at`), **aucune** réinitialisation de PIN par ce flux (anti-fraude : pas de reset après simple ajout d’email non prouvé).

### Utilisateur OTP Hora

1. **PUT /users/me/recovery-email** (Bearer) : enregistre l’email, envoie un lien de vérification (JWT, mock → logs serveur en dev).
2. **POST /users/email/verify** : `token` → positionne `email_verified_at`.
3. **POST /users/pin-recovery/request** : téléphone en `contact` **ou** `phone` **ou** `phone_number` (E.164) → si compte avec email vérifié, envoi d’un lien de reset (`pin_reset_tokens`, TTL configurable, usage unique).
4. **POST /users/pin-recovery/confirm** : `token` + nouveau PIN (`pin`, ou alias `code_pin` / `PIN` ; chaîne ou nombre 4–6 chiffres) → mise à jour `pin_hash`, rotation `token_version`.

### Entreprise (application)

Même logique métier, champs et tables dédiés :

1. **PUT /enterprises/me/recovery-email** (Bearer entreprise) : email sur `enterprise_accounts`, lien JWT (`type: enterprise_email_verify`).
2. **POST /enterprises/email/verify** : `token` → `email_verified_at` sur le compte entreprise.
3. **POST /enterprises/pin-recovery/request** : même champs téléphone que les utilisateurs (`contact` \| `phone` \| `phone_number`, E.164) → email vérifié requis ; envoi reset (`enterprise_pin_reset_tokens`).
4. **POST /enterprises/pin-recovery/confirm** : `token` + PIN (`pin` ou alias `code_pin` / `PIN`) → `pin_hash` + rotation `token_version` (invalidation JWT / sessions entreprise).

---

## API UTILISATEUR / OTP HORA (V1)

POST /users  
→ crée l’identité OTP Hora (`nom`, `prenom`, `pin`)  
→ `pin` stocké uniquement en hash (`pin_hash`)
→ retourne `access_token` + `refresh_token`

POST /users/login
→ connexion flexible via `phone_number` + `pin`
→ retourne `access_token` + `refresh_token` (JWT avec `role: user`)

POST /users/session/unlock
→ `refresh_token` + `pin` → nouveaux tokens (verrouillage session produit : pas de nouveau login téléphone)

GET /users/me/login-history
→ jusqu’à **5** dernières connexions (Bearer utilisateur) ; libellé formaté côté API

GET /users/:user_id  
→ retourne les informations utilisateur OTP Hora :
- nom
- prenom
- email, email_verified (pas d’email à l’inscription ; email via **PUT /users/me/recovery-email** uniquement)
- contacts
- devices
- linked_accounts_count
- linked_accounts (liste des comptes liés ; entreprises non supprimées)
- `pin_hash` seulement si `include_pin_hash=true`

PUT /users/me/recovery-email  
→ Bearer : définit ou modifie l’email de récupération ; invalide la vérification jusqu’à **POST /users/email/verify**

POST /users/email/verify  
→ `token` (JWT) : confirme l’email

POST /users/pin-recovery/request | confirm  
→ voir section « Récupération de compte »

POST /users/refresh-token
→ renouvelle `access_token` + `refresh_token` utilisateur

POST /users/logout
→ route protégée utilisateur
→ invalide les tokens actifs de la session (rotation serveur)

PATCH /users/:user_id
→ route protégée utilisateur (propriétaire uniquement)
→ modifie `nom` et/ou `pin` (**pas** l’email — utiliser **PUT /users/me/recovery-email**)

DELETE /users/:user_id
→ route protégée utilisateur (propriétaire uniquement)
→ supprime le compte utilisateur

POST /contacts  
→ ajoute le téléphone de l’utilisateur

POST /devices  
→ ajoute l’appareil de l’utilisateur (**Bearer utilisateur obligatoire**) ; `device_fingerprint`, `device_name` ou en-têtes `User-Agent` / `X-Device-Name`

POST /links/confirm  
→ confirmation utilisateur d’une demande de liaison entreprise

POST /auth/approve/:request_id  
POST /auth/reject/:request_id  
→ décision utilisateur sur la demande d’authentification

Routes utilisateur sensibles protégées via `Authorization: Bearer <access_token>`.

---

## IMPORTANT SUR L’API

- L’entreprise ne doit PAS créer d’utilisateur OTP Hora
- L’entreprise ne doit PAS gérer les contacts ou appareils
- L’entreprise ne doit PAS lire directement les informations d’identité OTP Hora (profil utilisateur), hors ce que permettent les endpoints partenaires
- L’identité (utilisateur, contacts, appareils, récupération) et la validation finale d’un lien (`identity_links` après acceptation utilisateur) ainsi que l’approbation / le refus d’une demande d’authentification relèvent d’OTP Hora / de l’utilisateur, pas de la clé entreprise
- Pour la liaison : l’entreprise initie une demande (`POST /links` avec `external_ref`) ; l’utilisateur confirme côté OTP Hora (`POST /links/confirm` avec `link_id` + `user_id`) ; seuls les liens **actifs** servent aux `auth_requests`
- L’entreprise consomme l’API partenaire avec sa clé pour :
  - demandes de liaison (`identity_links` côté demande NGONI)
  - `auth_requests` (création + lecture statut / événements)

---

## SÉCURITÉ

- Authentification via API key
- Validation utilisateur via mobile
- Expiration des demandes
- Journalisation complète
- Blocage possible via status
- Révocation des liens possible

---

## CAS D’ÉCHEC

- Relance de demande
- Méthode de récupération
- Support manuel
- Suspension temporaire

---

## ARCHITECTURE

- controller → HTTP
- service → logique métier
- repository → base de données
- middleware → sécurité, logs, auth

---

## RÈGLES DE DÉVELOPPEMENT

- Préserver l’architecture **controller → service → repository** et la gestion d’erreurs centralisée.
- Ne pas exposer les secrets (PIN, clés API en clair hors création).
- Téléphones : validation et normalisation **E.164** à l’écriture et à la lecture métier.
- JWT : distinguer explicitement les rôles **`user`** et **`company`** dans le payload.
- Maintenir la compatibilité des intégrations existantes (`x-api-key`, flux `links` / `auth_*`) lors d’évolutions.

---

## OBJECTIF FINAL

Construire une solution où :

- l’identité est centralisée dans OTP Hora
- l’entreprise ne fait que consommer l’API
- l’authentification se fait sans OTP
- l’utilisateur valide via application mobile