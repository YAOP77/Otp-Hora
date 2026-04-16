# Nouveau flux d’authentification (simple)

Ce flux **remplace l’OTP** comme étape de validation.  
Il **ne remplace pas** les routes Ngoni `register/login` : il décide juste si l’utilisateur a le droit d’y accéder.

---

## Acteurs

- **Entreprise / App (Ngoni, Facebook-like, etc.)** : déclenche la demande (serveur-à-serveur).
- **Utilisateur** : se connecte sur **Hora** et donne son consentement.
- **Hora** : intermédiaire (liaison + demande + décision).

---

## Pré-requis

- **Côté entreprise (recommandé)** : on utilise **uniquement `x-api-key`** (clé API stable) pour les appels serveur-à-serveur.
  - ✅ **Pas de “connexion entreprise”** (pas de session, pas de Bearer token).
  - Le `x-api-key` est obtenu **une seule fois** lors de `POST /api/enterprises/register` (champ `api_key`).
  - Il est stocké **côté serveur** (secret manager / env serveur), jamais côté mobile.
- **Côté utilisateur** : l’utilisateur se connecte sur Hora (téléphone + PIN) dans la page de consentement.

---

## Flux (résumé en 6 étapes)

### 1) (Entreprise) Créer une liaison

`POST https://otp-hora.onrender.com/api/links` (auth entreprise via `x-api-key`)

Body :
```json
{ "external_ref": "ext-user-001" }
```

Réponse : `link_id` en `pending`.

### 2) (Entreprise) Créer une demande d’auth

`POST https://otp-hora.onrender.com/api/auth/request` (auth entreprise via `x-api-key`)

Body :
```json
{ "link_id": "<link_id>" }
```

Réponse : `request_id` en `pending` (avec `expires_at`).

### 3) (Entreprise) Rediriger l’utilisateur vers Hora (consentement)

Ouvrir / rediriger vers :

`GET https://otp-hora.onrender.com/flow/consent?link_id=...&request_id=...&callback_url=...`

### 4) (Utilisateur sur Hora) Se connecter + confirmer + décider

Sur la page Hora :
- login (téléphone + PIN)
- confirmation de la liaison (`link_id`)
- **approve** ou **reject** de la demande (`request_id`)

### 5) (Hora) Rediriger vers l’app (callback)

Si `callback_url` est fourni et autorisé, Hora redirige vers :

`callback_url?hora_status=approved|rejected&hora_request_id=...&hora_link_id=...`

### 6) (Ngoni) Finaliser

- Si `hora_status=approved` :
  - si l’utilisateur n’a pas de compte → autoriser `register`
  - sinon → autoriser `login` / créer session
- Si `hora_status=rejected` (ou expiré) :
  - refuser proprement (message + possibilité de recommencer)

---

## Suivi côté entreprise (optionnel)

- Statut : `GET https://otp-hora.onrender.com/api/auth/status/:request_id`
- Audit trail : `GET https://otp-hora.onrender.com/api/auth/events/:request_id`

---

## Points importants (à ne pas rater)

- Il n’existe **pas** de `GET /api/links` ni `GET /api/links/:id` côté Hora.
- Le mobile **ne doit pas** appeler directement `links/confirm` ou `auth/approve|reject` dans ce nouveau modèle : c’est la page Hora `/flow/consent` qui gère tout.

