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
- **Auth Bearer**:
  - user: JWT `role: user`
  - entreprise: JWT `role: company`
- **Auth partenaire**: certaines routes acceptent `x-api-key` **ou** Bearer entreprise.

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
  "data": { "user_id": "uuid", "nom": "Yao", "prenom": "Pascal", "status": "active", "role": "user" },
  "auth": { "access_token": "jwt", "refresh_token": "jwt", "token_type": "Bearer" }
}
```
- Erreurs:
  - `400 INVALID_PIN_FORMAT`, `400 REQUEST_ERROR` (nom/prenom manquants)
- Changement recent:
  - PIN mobile tolerant (number/string via alias)
- Impact mobile:
  - envoyer `pin` de preference, alias maintenus

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
  "data": { "user_id": "uuid", "nom": "Yao", "prenom": "Pascal", "status": "active", "role": "user" },
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
- Impact mobile:
  - stocker numero en E.164 des la saisie

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
- Success 200: objet user + contacts/devices/linked accounts
- Erreurs:
  - `400 INVALID_UUID`
  - `403 FORBIDDEN`
  - `404 USER_NOT_FOUND`
  - `401 INVALID_TOKEN`
- Changement recent:
  - expose `email` + `email_verified` dans profil
- Impact mobile:
  - source unique pour etat email verification

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

### Identity links (B2B + user confirmation)

#### POST `/api/links`
- Auth: `x-api-key` **ou** Bearer entreprise
- Body:
  - `external_ref` (string, obligatoire)
- Success 201: lien `pending`
- Erreurs:
  - `401 MISSING_API_KEY|UNAUTHORIZED`
  - `403 INVALID_API_KEY`
  - `400 INVALID_INPUT`
  - `409 LINK_OR_REQUEST_EXISTS`
- Changement recent:
  - auth flexible API key ou Bearer entreprise
- Impact mobile:
  - surtout utilise cote partenaire/backend, pas app user

#### POST `/api/links/confirm`
- Auth: Bearer user
- Body:
  - `link_id` (uuid, obligatoire)
  - `user_id` (uuid, obligatoire, doit matcher token user)
- Success 200: lien `active`
- Erreurs: `400 INVALID_UUID|INVALID_INPUT`, `403 FORBIDDEN`, `404 LINK_NOT_FOUND|USER_NOT_FOUND`, `409 LINK_NOT_PENDING|LINK_ALREADY_BOUND|LINK_ALREADY_EXISTS`
- Changement recent: durcissement checks ownership

---

### Auth requests (demande de validation)

#### POST `/api/auth/request`
- Auth: `x-api-key` ou Bearer entreprise
- Body:
  - `link_id` (uuid, obligatoire)
- Success 201: `{ data: { request_id, status: "pending", expires_at } }`
- Erreurs:
  - `400 INVALID_INPUT|INVALID_UUID`
  - `401 UNAUTHORIZED`
  - `403 FORBIDDEN`
  - `404 LINK_NOT_FOUND`
  - `409 LINK_NOT_ACTIVE`
  - `429 RATE_LIMITED`
- Changement recent:
  - rate limiting + controles de propriete
- Impact mobile:
  - traiter `RATE_LIMITED` avec retry UX

#### GET `/api/auth/status/:request_id`
- Auth: `x-api-key` ou Bearer entreprise
- URL param: `request_id` uuid obligatoire
- Success 200: status courant (`pending|approved|rejected|expired`)
- Erreurs: `400 INVALID_INPUT|INVALID_UUID`, `401`, `403`, `404`
- Changement recent: coherent status expiry handling

#### POST `/api/auth/approve/:request_id`
#### POST `/api/auth/reject/:request_id`
- Auth: Bearer user
- URL param: `request_id` uuid
- Body: `user_id` uuid (must match token user)
- Success 200: statut resolu
- Erreurs:
  - `400 INVALID_INPUT|INVALID_UUID`
  - `403 FORBIDDEN`
  - `404 REQUEST_NOT_FOUND`
  - `409 ALREADY_RESOLVED`
  - `410 REQUEST_EXPIRED`
  - `429 RATE_LIMITED`
- Changement recent:
  - protections concurrence/idempotence ameliorees
- Impact mobile:
  - gerer proprement conflict/expired dans UI approval

---

### Auth events

#### GET `/api/auth/events/:request_id`
- Auth: `x-api-key` ou Bearer entreprise
- URL param: `request_id` uuid
- Success 200:
```json
{
  "data": [
    { "event_id": "uuid", "request_id": "uuid", "action": "created", "created_at": "ISO" }
  ]
}
```
- Erreurs: `400 INVALID_INPUT|INVALID_UUID`, `401`, `403`, `404 REQUEST_NOT_FOUND`
- Changement recent: endpoint stable, utile debug audit

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

---

## Checklist integration Flutter (pratique)

- Modeliser les erreurs sur `error.code`.
- Centraliser formatage telephone en E.164 avant requetes.
- Centraliser extraction PIN pour requetes (`pin` prioritaire).
- Mapper `403 RECOVERY_EMAIL_REQUIRED` vers ecran "ajouter/verifier email".
- Envoyer `device_name` depuis plugin device info a chaque registration device.

