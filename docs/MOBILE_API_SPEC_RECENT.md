# Mobile API Spec (Flutter) — Couverture Complete

Documentation exhaustive des APIs reellement montees sous `/api`, basee sur le code backend actuel.
Objectif: integration mobile sans ambiguite (Flutter/Cursor).

- Base URL: `https://<host>/api`
- Encodage: JSON UTF-8
- Erreur standard:

```json
{
  "error": {
    "message": "Message lisible",
    "code": "ERROR_CODE",
    "status": 400
  }
}
```

---

## Regles globales

- **Telephone**: format international obligatoire, ex. `+2250700000000`.
- **PIN**: 4 a 6 chiffres (`^\d{4,6}$`), accepte string ou number sur routes qui utilisent `pinFromBody`.
- **Alias telephone** (selon endpoints): `contact`, `phone`, `phone_number`.
- **Alias PIN** (selon endpoints): `pin`, `PIN`, `code_pin`.
- **`user_key`**: identifiant public court de l'utilisateur Hora (format `x-<2 lettres>-<6 hex>`, ex. `x-th-a1b2c3`). Retourne par POST `/api/users`, POST `/api/users/login`, GET `/api/users/:user_id`. Sert de cle d'echange cote entreprise pour initier une liaison via POST `/api/links`.
- **Auth Bearer**:
  - user: JWT `role: user`
  - entreprise: JWT `role: company`
- **Auth partenaire**: certaines routes acceptent `x-api-key` **ou** Bearer entreprise.

---

## Modeles de donnees impactes (refactor recent)

- `users` expose desormais un champ **`user_key`** (string unique, ex. `x-th-a1b2c3`). A stocker cote mobile apres inscription / login.
- `identity_links`:
  - champ `external_ref` **supprime** (ne plus envoyer ni lire)
  - champ `status` prend les valeurs `pending`, `approved`, `rejected`
- Tables `auth_requests` et `auth_events` **supprimees** (plus de flux `/api/auth/*`).

---

## Inventaire complet des APIs (/api)

### Health

#### GET `/api/health`
- Auth: non
- Description: statut service
- Headers: aucun
- Success 200: texte simple `API is running`
- Changement recent: aucun changement majeur de contrat
- Impact mobile: endpoint de ping pre-login

---

### Users - authentification et profil OTP Hora

#### POST `/api/users`
- Auth: non
- Description: inscription OTP Hora
- Headers: `Content-Type: application/json`
- Body:
  - `nom` (string, obligatoire)
  - `prenom` (string, obligatoire)
  - `pin|PIN|code_pin` (string|number, obligatoire, 4-6 chiffres)
- Exemple:
```json
{
  "nom": "Yao",
  "prenom": "Pascal",
  "pin": 1234
}
```
- Success 201:
```json
{
  "data": { "user_id": "uuid", "user_key": "x-th-a1b2c3", "nom": "Yao", "prenom": "Pascal", "status": "active", "role": "user" },
  "auth": { "access_token": "jwt", "refresh_token": "jwt", "token_type": "Bearer" }
}
```
- Erreurs:
  - `400 INVALID_PIN_FORMAT`, `400 REQUEST_ERROR` (nom/prenom manquants)
- Changement recent:
  - PIN mobile tolerant (number/string via alias)
  - ajout `user_key` dans la reponse (identifiant public a partager aux entreprises)
- Impact mobile:
  - envoyer `pin` de preference, alias maintenus
  - persister `user_key` localement pour l'afficher dans le profil / partager a une entreprise

#### POST `/api/users/login`
- Auth: non
- Description: connexion utilisateur par telephone + PIN
- Headers: `Content-Type: application/json`
- Body:
  - `phone_number|phone|contact` (string, obligatoire, E.164)
  - `pin|PIN|code_pin` (string|number, obligatoire)
- Success 200:
```json
{
  "data": { "user_id": "uuid", "user_key": "x-th-a1b2c3", "nom": "Yao", "prenom": "Pascal", "status": "active", "role": "user" },
  "auth": { "access_token": "jwt", "refresh_token": "jwt", "token_type": "Bearer" }
}
```
- Erreurs:
  - `400 INVALID_INPUT` (phone missing)
  - `400 INVALID_PHONE`
  - `400 INVALID_PIN_FORMAT`
  - `401 INVALID_CREDENTIALS`
- Changement recent:
  - login aligne sur format telephone avec indicatif obligatoire
  - alias phone/contact supportes
  - `user_key` present dans la reponse
- Impact mobile:
  - stocker numero en E.164 des la saisie
  - rafraichir `user_key` en cache a chaque login

#### POST `/api/users/session/unlock`
- Auth: non
- Description: reouverture session via refresh token + PIN
- Headers: `Content-Type: application/json`
- Body:
  - `refresh_token` (string, obligatoire)
  - `pin|PIN|code_pin` (string|number, obligatoire)
- Success 200:
```json
{
  "data": { "access_token": "jwt", "refresh_token": "jwt", "token_type": "Bearer" }
}
```
- Erreurs:
  - `400 INVALID_INPUT`, `400 INVALID_PIN_FORMAT`
  - `401 INVALID_SESSION`, `401 INVALID_PIN`, `401 INVALID_REFRESH_TOKEN`
- Changement recent:
  - support des aliases PIN cote mobile
- Impact mobile:
  - workflow lock-screen sans ressaisie telephone

#### POST `/api/users/refresh-token`
- Auth: non
- Description: rotation tokens user
- Headers: `Content-Type: application/json`
- Body: `refresh_token` (string, obligatoire)
- Success 200:
```json
{ "data": { "access_token": "jwt", "refresh_token": "jwt", "token_type": "Bearer" } }
```
- Erreurs: `400 INVALID_INPUT`, `401 INVALID_REFRESH_TOKEN`
- Changement recent: aucun breaking; aligne token_version
- Impact mobile: utiliser ce endpoint pour silent refresh

#### POST `/api/users/logout`
- Auth: oui (Bearer user)
- Headers:
  - `Authorization: Bearer <user_access_token>`
  - `Content-Type: application/json`
- Description: invalide la session (token version++)
- Success 200: `{ "data": { "message": "Déconnexion réussie" } }`
- Erreurs: `401 MISSING_TOKEN`, `401 INVALID_TOKEN`
- Changement recent: invalidation robuste conservee
- Impact mobile: purge tokens locaux apres 200

#### GET `/api/users/:user_id`
- Auth: oui (Bearer user)
- Description: profil utilisateur (self)
- URL params:
  - `user_id` (uuid, obligatoire)
- Query:
  - `include_pin_hash=true` (optionnel, usage debug)
- Success 200: objet user contenant notamment `user_id`, `user_key`, `nom`, `prenom`, `status`, `role`, `email`, `email_verified`, `contacts`, `devices`, `linked_accounts_count`, `linked_accounts[]`
- Erreurs:
  - `400 INVALID_UUID`
  - `403 FORBIDDEN`
  - `404 USER_NOT_FOUND`
  - `401 INVALID_TOKEN`
- Changement recent:
  - expose `email` + `email_verified` dans profil
  - expose `user_key` dans profil
  - `linked_accounts[]` represente les liaisons de l'utilisateur (`link_id`, `company_id`, `status` parmi `pending|approved|rejected`) — plus de champ `external_ref`
- Impact mobile:
  - source unique pour etat email verification
  - affichage `user_key` dans l'ecran "partager mon identifiant Hora"
  - utiliser `linked_accounts[]` pour afficher l'historique des liaisons dans le profil

#### PATCH `/api/users/:user_id`
- Auth: oui (Bearer user, self only)
- Body:
  - `nom` (string, optionnel)
  - `pin|PIN|code_pin` (string|number, optionnel)
  - `email` / `recovery_email` => interdit sur cette route
- Success 200: user mis a jour
- Erreurs:
  - `400 INVALID_UUID`, `400 INVALID_INPUT`, `400 INVALID_PIN_FORMAT`
  - `400 USE_RECOVERY_EMAIL_ENDPOINT`
  - `403 FORBIDDEN`, `404 USER_NOT_FOUND`
- Changement recent:
  - redirection explicite vers route recovery-email pour email
- Impact mobile:
  - ne plus PATCH email ici

#### DELETE `/api/users/:user_id`
- Auth: oui (Bearer user, self only)
- Success 200:
```json
{ "data": { "deleted": true, "user_id": "uuid" } }
```
- Erreurs: `400 INVALID_UUID`, `403 FORBIDDEN`, `404 USER_NOT_FOUND`
- Changement recent: aucun breaking
- Impact mobile: logout et purge locale apres suppression

#### GET `/api/users/me/login-history`
- Auth: oui (Bearer user)
- Description: 5 dernieres connexions max
- Success 200:
```json
{ "data": { "login_history": [{ "history_id": "uuid", "label": "iPhone - ...", "device_name": "iPhone", "connected_at": "ISO" }] } }
```
- Erreurs: `401 INVALID_TOKEN`
- Changement recent: endpoint maintenu
- Impact mobile: affichage activite recente

---

### User Recovery (email + forgot PIN)

#### PUT `/api/users/me/recovery-email`
- Auth: oui (Bearer user)
- Body: `email` (string, obligatoire, valide, max 320)
- Success 200:
```json
{
  "data": {
    "message": "Un email de vérification a été envoyé (simulation en développement : voir les logs serveur).",
    "email": "user@example.com",
    "email_verified": false
  }
}
```
- Erreurs:
  - `400 INVALID_EMAIL`
  - `409 EMAIL_ALREADY_REGISTERED`
  - `401 INVALID_TOKEN`
- Changement recent:
  - email de recuperation obligatoire pour reset PIN
- Impact mobile:
  - forcer etape verification email dans onboarding securite

#### POST `/api/users/email/verify`
- Auth: non
- Body: `token` (string, obligatoire)
- Success 200: `{ data: { message, email, email_verified: true } }`
- Erreurs:
  - `400 INVALID_INPUT`
  - `400 INVALID_VERIFICATION_TOKEN`
  - `400 EMAIL_TOKEN_MISMATCH`
  - `404 USER_NOT_FOUND`
- Changement recent: nouveau flow verification avant reset
- Impact mobile: deep-link verification a gerer proprement

#### POST `/api/users/pin-recovery/request`
- Auth: non
- Body (au moins un):
  - `contact` (string)
  - `phone` (string)
  - `phone_number` (string)
- Success 200:
```json
{
  "data": {
    "message": "Si un compte éligible existe, un email de réinitialisation a été envoyé. Vérifiez votre boîte mail.",
    "expires_in_minutes": 15
  }
}
```
- Erreurs:
  - `400 VALIDATION_ERROR`, `400 INVALID_PHONE`
  - `403 RECOVERY_EMAIL_REQUIRED`
  - `404 RECOVERY_NOT_AVAILABLE`
- Changement recent:
  - accepte alias `contact|phone|phone_number`
- Impact mobile:
  - reutiliser meme DTO pour user et entreprise

#### POST `/api/users/pin-recovery/confirm`
- Auth: non
- Body:
  - `token` (string, obligatoire)
  - `pin` (string|number, obligatoire, 4-6)
- Success 200:
```json
{
  "data": {
    "message": "Votre code PIN a été réinitialisé. Vous pouvez vous connecter avec le nouveau code."
  }
}
```
- Erreurs:
  - `400 INVALID_INPUT`
  - `400 INVALID_PIN_FORMAT`
  - `400 INVALID_OR_EXPIRED_RESET_TOKEN`
- Changement recent:
  - reset invalide toutes sessions via token_version++
- Impact mobile:
  - relogin obligatoire apres succes

---

### Entreprise (application)

#### POST `/api/enterprises/register`
- Auth: non
- Body:
  - `nom_entreprise|nom` (string, obligatoire)
  - `phone|phone_number|contact` (string, obligatoire, E.164)
  - `pin|PIN|code_pin` (string|number, obligatoire)
- Success 201:
```json
{
  "data": { "company_id": "uuid", "nom_entreprise": "NGONI", "status": "valider", "phone_e164": "+2250700000000", "role": "company" },
  "api_key": "<raw_api_key_once>",
  "auth": { "access_token": "jwt", "refresh_token": "jwt", "token_type": "Bearer" }
}
```
- Erreurs:
  - `400 INVALID_INPUT`, `400 INVALID_PHONE`, `400 INVALID_PIN_FORMAT`
  - `409 PHONE_ALREADY_REGISTERED`
- Changement recent:
  - telephone avec indicatif + alias harmonises
- Impact mobile:
  - sauvegarder `api_key` uniquement si besoin B2B; jamais en clair long terme

#### POST `/api/enterprises/login`
- Auth: non
- Body:
  - `phone|phone_number|contact` (string, obligatoire, E.164)
  - `pin|PIN|code_pin` (string|number, obligatoire)
- Success 200: `{ data: company, auth: tokens }`
- Erreurs:
  - `400 INVALID_PHONE`, `400 INVALID_PIN_FORMAT`
  - `401 INVALID_CREDENTIALS`
- Changement recent:
  - alignement total avec login user sur formats mobiles
- Impact mobile:
  - unifier composant de saisie numero international

#### POST `/api/enterprises/session/unlock`
- Auth: non
- Body: `refresh_token` + `pin|PIN|code_pin`
- Success 200: `{ data: { access_token, refresh_token, token_type } }`
- Erreurs: `400 INVALID_INPUT`, `400 INVALID_PIN_FORMAT`, `401 INVALID_SESSION|INVALID_PIN|INVALID_REFRESH_TOKEN`
- Changement recent: support alias PIN
- Impact mobile: ecran de verrouillage enterprise

#### POST `/api/enterprises/refresh-token`
- Auth: non
- Body: `refresh_token` obligatoire
- Success 200: `{ data: { access_token, refresh_token, token_type } }`
- Erreurs: `400 INVALID_INPUT`, `401 INVALID_REFRESH_TOKEN|UNAUTHORIZED`
- Changement recent: aucun breaking
- Impact mobile: refresh classique

#### GET `/api/enterprises/me`
- Auth: oui (Bearer entreprise)
- Success 200:
```json
{
  "data": {
    "company_id": "uuid",
    "nom_entreprise": "NGONI",
    "status": "active",
    "phone_e164": "+2250700000000",
    "email": "contact@entreprise.com",
    "email_verified": true,
    "role": "company",
    "devices": [],
    "linked_users": [],
    "login_history": []
  }
}
```
- Erreurs: `401 INVALID_TOKEN`, `404 COMPANY_NOT_FOUND`
- Changement recent:
  - ajout `email` et `email_verified` dans profil
- Impact mobile:
  - afficher status securite compte entreprise

#### PATCH `/api/enterprises/me`
- Auth: oui
- Body:
  - `nom_entreprise|nom` (optionnel)
  - `phone|phone_number` (optionnel)
  - `pin|PIN|code_pin` (optionnel)
  - `email` interdit ici
- Success 200: compte mis a jour
- Erreurs:
  - `400 INVALID_INPUT`, `400 INVALID_PIN_FORMAT`, `400 INVALID_PHONE`
  - `400 USE_RECOVERY_EMAIL_ENDPOINT`
  - `409 PHONE_ALREADY_REGISTERED`
  - `404 COMPANY_NOT_FOUND`
- Changement recent:
  - blocage explicite email via endpoint dedie
  - normalisation PIN mobile
- Impact mobile:
  - separer ecran profil et ecran email de recuperation

#### DELETE `/api/enterprises/me`
- Auth: oui
- Body: `pin` obligatoire (4-6 chiffres)
- Success 200: `{ data: { message, company_id, deleted: true } }`
- Erreurs:
  - `400 VALIDATION_ERROR|INVALID_PIN_FORMAT`
  - `401 INVALID_PIN`
  - `404 COMPANY_NOT_FOUND`
- Changement recent:
  - suppression logique + invalidation sessions + revocation links
- Impact mobile:
  - purge tokens et reset local state

#### POST `/api/enterprises/logout`
- Auth: oui
- Success 200: `{ data: { message: "Déconnexion réussie" } }`
- Erreurs: `401 INVALID_TOKEN`
- Changement recent: aucune rupture

#### GET `/api/enterprises/me/devices`
- Auth: oui
- Success 200: `{ data: { devices: [...] } }`
- Changement recent:
  - endpoint conserve; utile pour observabilite session
- Impact mobile:
  - afficher appareils actifs

#### POST `/api/enterprises/me/devices`
- Auth: oui
- Body:
  - `device_fingerprint` (string, obligatoire)
  - `device_name` (string, optionnel)
- Description: upsert appareil entreprise
- Success 201:
```json
{
  "data": {
    "device_id": "uuid",
    "company_id": "uuid",
    "device_fingerprint": "fp-123",
    "trusted": false,
    "device_name": "Samsung S24",
    "user_agent": "okhttp/...",
    "last_seen_at": "ISO"
  }
}
```
- Erreurs: `400 INVALID_INPUT`, `401 INVALID_TOKEN`
- Changement recent:
  - endpoint mobile entreprise consolide
- Impact mobile:
  - envoyer `device_name` depuis Flutter device info

#### GET `/api/enterprises/me/linked-users`
- Auth: oui
- Success 200: `{ data: { linked_users: [...] } }`
- Erreurs: `401 INVALID_TOKEN`
- Changement recent: aucun breaking

#### GET `/api/enterprises/me/login-history`
- Auth: oui
- Success 200: `{ data: { login_history: [...] } }`
- Erreurs: `401 INVALID_TOKEN`
- Changement recent: exposer jusqu'a 5 dernieres connexions

---

### Enterprise Recovery (email + forgot PIN)

#### PUT `/api/enterprises/me/recovery-email`
- Auth: oui (Bearer entreprise)
- Body: `email` (string, obligatoire, valide)
- Success 200: `{ data: { message, email, email_verified: false } }`
- Erreurs: `400 INVALID_EMAIL`, `409 EMAIL_ALREADY_REGISTERED`, `401 INVALID_TOKEN`
- Changement recent: nouveau flow recovery enterprise
- Impact mobile: etape obligatoire avant forgot PIN

#### POST `/api/enterprises/email/verify`
- Auth: non
- Body: `token` obligatoire
- Success 200: `{ data: { message, email, email_verified: true } }`
- Erreurs: `400 INVALID_VERIFICATION_TOKEN|EMAIL_TOKEN_MISMATCH|INVALID_INPUT`, `404 COMPANY_NOT_FOUND`
- Changement recent: ajout verification email entreprise

#### POST `/api/enterprises/pin-recovery/request`
- Auth: non
- Body: `contact|phone|phone_number` (au moins un)
- Success 200: `{ data: { message, expires_in_minutes } }`
- Erreurs: `400 VALIDATION_ERROR|INVALID_PHONE`, `403 RECOVERY_EMAIL_REQUIRED`, `404 RECOVERY_NOT_AVAILABLE`
- Changement recent:
  - meme logique forte que user: email verifie requis
- Impact mobile:
  - affichage message guidance si `RECOVERY_EMAIL_REQUIRED`

#### POST `/api/enterprises/pin-recovery/confirm`
- Auth: non
- Body:
  - `token` obligatoire
  - `pin|PIN|code_pin` (4-6 chiffres)
- Success 200:
```json
{
  "data": {
    "message": "Le code PIN entreprise a été réinitialisé. Vous pouvez vous connecter avec le nouveau code."
  }
}
```
- Erreurs: `400 INVALID_INPUT|INVALID_PIN_FORMAT|INVALID_OR_EXPIRED_RESET_TOKEN`
- Changement recent: invalidation sessions entreprise apres reset

---

### Devices utilisateur

#### POST `/api/devices`
- Auth: oui (Bearer user)
- Headers:
  - `Authorization: Bearer <user_access_token>`
  - `Content-Type: application/json`
- Body:
  - `device_fingerprint` (string, obligatoire)
  - `device_name` (optionnel, conseille)
- Success 201:
```json
{
  "data": {
    "device_id": "uuid",
    "user_id": "uuid",
    "device_fingerprint": "android-abc-123",
    "trusted": false,
    "device_name": "Pixel 8",
    "user_agent": "okhttp/...",
    "last_seen_at": "ISO"
  }
}
```
- Erreurs:
  - `400` contexte utilisateur manquant / `device_fingerprint` manquant
  - `404` utilisateur introuvable
  - `401 INVALID_TOKEN`
- Changement recent:
  - enforcement Bearer obligatoire sur `/devices`
- Impact mobile:
  - appeler apres login/refresh pour tracer appareil

---

### Contacts utilisateur

#### POST `/api/contacts`
- Auth: non (actuel)
- Body:
  - `user_id` (string, obligatoire)
  - `phone_number` (string, obligatoire, E.164)
- Success 201: contact cree
- Erreurs:
  - `400` champs manquants / `INVALID_PHONE`
  - `404` utilisateur introuvable
- Changement recent:
  - normalisation telephone stricte avec indicatif
- Impact mobile:
  - toujours formatter en E.164 avant envoi

---

### Identity links (cote entreprise)

> Le flux de liaison a ete refondu : plus d'`external_ref`, plus de table `auth_requests`. L'entreprise declenche la liaison en passant le `user_key` que l'utilisateur lui a transmis. L'approbation/refus se fait ensuite cote utilisateur via les routes `/api/me/links/*` (voir section suivante).

#### POST `/api/links`
- Auth: `x-api-key` **ou** Bearer entreprise (`requireEnterpriseAuth`)
- Description: initie (ou recupere) une liaison entre l'entreprise authentifiee et l'utilisateur identifie par `user_key`. **Idempotent** : si une liaison existe deja pour `(user → company)`, elle est retournee telle quelle.
- Body:
  - `user_key` (string, obligatoire, format `x-<2 lettres>-<6 hex>`, ex. `x-th-a1b2c3`)
- Success 201 (liaison creee):
```json
{
  "data": {
    "link_id": "uuid",
    "company_id": "uuid",
    "user_id": "uuid",
    "status": "pending",
    "consent_url": "https://otp-hora.onrender.com/flow/consent?link_id=<link_id>"
  }
}
```
- Success 200 (liaison deja existante):
```json
{
  "data": {
    "link_id": "uuid",
    "company_id": "uuid",
    "user_id": "uuid",
    "status": "pending|approved|rejected",
    "consent_url": "https://otp-hora.onrender.com/flow/consent?link_id=<link_id>"
  }
}
```
  - `consent_url` n'est present que pour `status: pending`.
- Erreurs:
  - `400 INVALID_INPUT` (`user_key` manquant)
  - `400 INVALID_USER_KEY` (format invalide)
  - `401 MISSING_API_KEY|UNAUTHORIZED`
  - `403 INVALID_API_KEY`
  - `404 USER_NOT_FOUND`
  - `409 USER_INACTIVE`
- Changement recent:
  - `external_ref` supprime, remplace par `user_key`
  - comportement idempotent (pas de `409 LINK_OR_REQUEST_EXISTS`)
  - retourne `consent_url` pour declencher le flow de consentement
- Impact mobile:
  - endpoint utilise cote partenaire/entreprise, pas depuis l'app user
  - cote app entreprise Hora (si presente), remplacer l'ancien DTO `{ external_ref }` par `{ user_key }`

#### GET `/api/links/:link_id`
- Auth: `x-api-key` **ou** Bearer entreprise
- Description: polling du statut courant d'une liaison creee par l'entreprise.
- URL params:
  - `link_id` (uuid, obligatoire)
- Success 200:
```json
{
  "data": {
    "link_id": "uuid",
    "company_id": "uuid",
    "user_id": "uuid",
    "status": "pending|approved|rejected",
    "consent_url": "https://otp-hora.onrender.com/flow/consent?link_id=<link_id>"
  }
}
```
  - `consent_url` present seulement si `status === "pending"`.
- Erreurs: `400 INVALID_UUID`, `401 UNAUTHORIZED`, `404 LINK_NOT_FOUND`
- Changement recent: nouveau endpoint de polling (remplace l'ancien `GET /api/auth/status/:request_id`)

---

### Identity links (cote utilisateur — nouvelles routes mobile)

> Nouveau flux: l'utilisateur gere desormais ses liaisons directement depuis l'app mobile Hora. Quand il ouvre l'app et qu'il a des liaisons `pending`, il peut les approuver ou les refuser sans passer par la page web `/flow/consent`.

#### GET `/api/me/links`
- Auth: oui (Bearer user)
- Description: liste les liaisons de l'utilisateur authentifie (toutes, ou filtrees par statut).
- Headers:
  - `Authorization: Bearer <user_access_token>`
- Query:
  - `status` (optionnel): `pending` | `approved` | `rejected`
- Success 200:
```json
{
  "data": [
    {
      "link_id": "uuid",
      "company_id": "uuid",
      "nom_entreprise": "NGONI",
      "status": "pending"
    }
  ]
}
```
- Erreurs:
  - `401 UNAUTHORIZED|INVALID_TOKEN`
- Changement recent: nouvelle route exposant les liaisons cote utilisateur
- Impact mobile:
  - ecran "Mes liaisons" / notifications en attente
  - badge de notification quand `status=pending` retourne une liste non vide

#### POST `/api/me/links/:link_id/approve`
- Auth: oui (Bearer user)
- Description: approuve une liaison `pending`. Idempotent si la liaison est deja `approved`.
- URL params:
  - `link_id` (uuid, obligatoire)
- Body: aucun (ou `{}`)
- Success 200:
```json
{
  "data": {
    "link_id": "uuid",
    "company_id": "uuid",
    "user_id": "uuid",
    "status": "approved"
  }
}
```
- Erreurs:
  - `400 INVALID_UUID`
  - `401 UNAUTHORIZED`
  - `404 LINK_NOT_FOUND`
  - `409 LINK_NOT_PENDING` (la liaison est deja `rejected`)
- Changement recent: remplace l'ancien `POST /api/auth/approve/:request_id` + `POST /api/links/confirm`
- Impact mobile:
  - bouton "Approuver" sur la carte liaison
  - gerer `409 LINK_NOT_PENDING` (proposer suppression si `rejected`)

#### POST `/api/me/links/:link_id/reject`
- Auth: oui (Bearer user)
- Description: refuse une liaison `pending`. Idempotent si la liaison est deja `rejected`.
- URL params:
  - `link_id` (uuid, obligatoire)
- Body: aucun (ou `{}`)
- Success 200:
```json
{
  "data": {
    "link_id": "uuid",
    "company_id": "uuid",
    "user_id": "uuid",
    "status": "rejected"
  }
}
```
- Erreurs:
  - `400 INVALID_UUID`
  - `401 UNAUTHORIZED`
  - `404 LINK_NOT_FOUND`
  - `409 LINK_NOT_PENDING` (la liaison est deja `approved`)
- Changement recent: remplace l'ancien `POST /api/auth/reject/:request_id`
- Impact mobile:
  - bouton "Refuser" sur la carte liaison
  - afficher message d'aide si `409 LINK_NOT_PENDING`

#### DELETE `/api/me/links/:link_id`
- Auth: oui (Bearer user)
- Description: supprime definitivement une liaison **rejetee**. Permet a l'utilisateur de repartir a zero : l'entreprise pourra de nouveau creer une liaison via `POST /api/links` avec le meme `user_key`.
- URL params:
  - `link_id` (uuid, obligatoire)
- Success 200:
```json
{
  "data": {
    "deleted": true,
    "link_id": "uuid"
  }
}
```
- Erreurs:
  - `400 INVALID_UUID`
  - `401 UNAUTHORIZED`
  - `404 LINK_NOT_FOUND`
  - `409 LINK_NOT_REJECTED` (seules les liaisons `rejected` peuvent etre supprimees)
- Changement recent: nouvelle route — permet le nettoyage cote utilisateur
- Impact mobile:
  - action "Supprimer" disponible uniquement sur les cartes `rejected`
  - apres succes, retirer la liaison de la liste locale

---

## Deep linking mobile (Universal Links / App Links)

> Important pour l'app Hora mobile : les entreprises recoivent une `consent_url` de la forme `https://otp-hora.onrender.com/flow/consent?link_id=<link_id>` lorsqu'elles appellent `POST /api/links`. Cette URL est partagee a l'utilisateur (SMS, QR code, message in-app partenaire, etc.).

- **Objectif** : quand l'utilisateur Hora a deja l'app installee, cliquer sur `consent_url` doit ouvrir l'app directement sur l'ecran d'approbation de la liaison, sans passer par la page web.
- **iOS** : configurer les **Universal Links** via `apple-app-site-association` (scope `/flow/consent*`). L'app Flutter doit ecouter l'URL entrante (`uni_links`, `app_links`, ou plugin equivalent) et router vers l'ecran "liaison en attente" avec le `link_id` extrait de la query string.
- **Android** : configurer les **App Links** via `AndroidManifest.xml` (`intent-filter` avec `autoVerify="true"`) + hosting du `assetlinks.json` sur le domaine `otp-hora.onrender.com`. Meme logique de routing Flutter.
- **Fallback web** : si l'app n'est pas installee (ou si la verification Universal/App Link echoue), la page web `/flow/consent?link_id=...` reste fonctionnelle et propose l'approbation / refus via navigateur.
- **Flow recommande app ouverte** : une fois le `link_id` recu via deep link, l'app peut directement appeler `POST /api/me/links/:link_id/approve` ou `/reject` (Bearer user). Pas besoin de refaire un `GET /api/me/links` si l'ecran est focalise.
- **Flow recommande app fermee** : apres ouverture via deep link, si l'utilisateur n'est pas logge, presenter l'ecran de login puis rediriger automatiquement sur l'ecran liaison avec le `link_id` memorise.

---

## Securite mobile - points obligatoires

- Toujours utiliser HTTPS.
- Ne jamais logger PIN, refresh token, reset token.
- Purger tokens locaux apres:
  - logout
  - reset PIN confirme
  - suppression compte
- Sur `401 INVALID_TOKEN`: tenter refresh puis fallback login.
- Sur forgot PIN:
  - ne pas deduire existence compte d'apres UX
  - respecter message generique backend
- Ne jamais logger ni exposer `user_key` dans des canaux publics non chiffres ; le traiter comme un identifiant sensible assimile a un numero de compte.

---

## Resume des changements recents critiques

1. **Telephone international obligatoire** sur flux login/recovery/contacts (E.164).
2. **Alias mobiles** supportes (`contact|phone|phone_number`, `pin|PIN|code_pin`) sur plusieurs endpoints.
3. **Flow recovery robuste** user + entreprise:
   - email de recuperation
   - verification email
   - reset PIN via token usage unique
4. **Sessions securisees**: `token_version++` lors d'actions sensibles (logout, reset, delete).
5. **Devices**:
   - `/api/devices` user avec Bearer obligatoire
   - `/api/enterprises/me/devices` pour entreprise
6. **Refactor liaisons identites** (refactor majeur):
   - ajout du champ **`user_key`** sur les utilisateurs (retourne par inscription / login / profil)
   - suppression du champ `external_ref` sur `identity_links`
   - suppression des tables `auth_requests` et `auth_events` (et de toutes les routes `/api/auth/*`)
   - suppression de la route `POST /api/links/confirm`
   - `POST /api/links` accepte desormais `{ user_key }` et est idempotent, retourne `{ link_id, status, consent_url }`
   - nouveau endpoint entreprise `GET /api/links/:link_id` pour polling
   - nouvelles routes mobile utilisateur: `GET /api/me/links`, `POST /api/me/links/:link_id/approve`, `POST /api/me/links/:link_id/reject`, `DELETE /api/me/links/:link_id`
   - statuts `identity_links.status` desormais `pending | approved | rejected`
7. **Deep linking** : `consent_url` pointe vers `https://otp-hora.onrender.com/flow/consent?link_id=<link_id>` ; a intercepter cote mobile via Universal Links (iOS) et App Links (Android).

---

## Checklist integration Flutter (pratique)

- Modeliser les erreurs sur `error.code`.
- Centraliser formatage telephone en E.164 avant requetes.
- Centraliser extraction PIN pour requetes (`pin` prioritaire).
- Mapper `403 RECOVERY_EMAIL_REQUIRED` vers ecran "ajouter/verifier email".
- Envoyer `device_name` depuis plugin device info a chaque registration device.
- Persister `user_key` localement (secure storage) apres inscription/login/profil et l'afficher dans l'ecran "partager mon identifiant Hora".
- Implementer ecran "Mes liaisons" alimente par `GET /api/me/links` (filtre par defaut `status=pending` pour mettre en avant les actions a faire).
- Gerer les codes de conflit propres au nouveau flow:
  - `409 LINK_NOT_PENDING` sur approve/reject → la liaison est deja resolue, recharger la liste.
  - `409 LINK_NOT_REJECTED` sur DELETE → n'afficher l'action supprimer que si `status === "rejected"`.
- Configurer Universal Links (iOS) + App Links (Android) pour intercepter `https://otp-hora.onrender.com/flow/consent?link_id=...` et router vers l'ecran d'approbation.
- Supprimer du code mobile tout reste d'integration des anciennes routes: `POST /api/auth/request`, `GET /api/auth/status/:request_id`, `POST /api/auth/approve/:request_id`, `POST /api/auth/reject/:request_id`, `GET /api/auth/events/:request_id`, `POST /api/links/confirm`, et tout usage du champ `external_ref`.

