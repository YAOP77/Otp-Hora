# Flux d'authentification Hora (simplifié)

Ce document décrit le flux d'authentification entre une application partenaire (Ngoni, Facebook-like, etc.) et Hora.

> **Remplacement de l'OTP** : ce flux remplace la vérification OTP classique par une approbation utilisateur depuis Hora.

---

## Acteurs

- **Entreprise partenaire** : appelle Hora en serveur-à-serveur avec son `x-api-key`.
- **Utilisateur** : possède un compte Hora (donc une `user_key`) et approuve/refuse les demandes depuis Hora (web ou mobile).
- **Hora** : pivot qui stocke les liaisons et orchestre les approbations.

---

## Pré-requis

### Côté entreprise

- Avoir un compte Hora entreprise → possède une **`x-api-key`** reçue une seule fois via `POST /api/enterprises/register`.
- La `x-api-key` est stockée **côté serveur** de l'entreprise (env var / secret manager), **jamais** côté client.

### Côté utilisateur

- Avoir un compte Hora → possède une **`user_key`** humainement lisible (ex : `x-th-a1b2c3`) visible sur son profil Hora.

---

## Flux en 3 étapes

### 1) L'utilisateur saisit sa `user_key` dans l'app partenaire

Ngoni (ou autre) demande à l'utilisateur : *« Entrez votre identifiant Hora »*. L'utilisateur saisit par exemple `x-th-a1b2c3`.

### 2) L'app partenaire crée une liaison avec Hora

```http
POST https://otp-hora.onrender.com/api/links
x-api-key: <clé API entreprise>
Content-Type: application/json

{ "user_key": "x-th-a1b2c3" }
```

Réponse :

```json
{
  "data": {
    "link_id": "1812da79-1a19-4866-84a4-fc11564e47dc",
    "user_id": "...",
    "company_id": "...",
    "status": "pending",
    "consent_url": "https://otp-hora.onrender.com/flow/consent?link_id=1812da79-1a19-4866-84a4-fc11564e47dc"
  }
}
```

> **Idempotent** : si une liaison existe déjà pour cette `user_key + company_id`, Hora retourne l'existante avec son status actuel (`pending` / `approved` / `rejected`).

### 3) L'app partenaire redirige l'utilisateur vers `consent_url`

L'utilisateur arrive sur la page Hora :
- S'il n'est pas connecté → formulaire login (téléphone + PIN)
- Une fois connecté → page *« {Partenaire} demande à vous authentifier. Autoriser ? »*
- L'utilisateur clique **Autoriser** ou **Refuser**.

---

## Polling côté partenaire

L'app partenaire interroge régulièrement :

```http
GET https://otp-hora.onrender.com/api/links/:link_id
x-api-key: <clé API entreprise>
```

Réponse :

```json
{
  "data": {
    "link_id": "1812da79-1a19-4866-84a4-fc11564e47dc",
    "user_id": "...",
    "company_id": "...",
    "status": "pending"
  }
}
```

> `POST /api/links` est idempotent : on peut rappeler le POST au lieu du GET — le résultat est identique.

### Suite selon le statut

| Statut | Action côté partenaire |
|--------|------------------------|
| `pending` | Continuer à poll |
| `approved` | Autoriser l'inscription / connexion de l'utilisateur |
| `rejected` | Refuser l'authentification, afficher un message à l'utilisateur |

---

## Cas particuliers

### L'utilisateur a refusé par erreur

Il peut aller dans son app Hora → section « Mes liaisons » → supprimer la liaison rejetée via :

```http
DELETE /api/me/links/:link_id
Authorization: Bearer <user_access_token>
```

Après suppression, l'app partenaire peut recréer une liaison via `POST /api/links` (elle repassera en `pending`).

### L'utilisateur se reconnecte plus tard

Si la liaison est déjà `approved`, `POST /api/links` retourne la liaison telle quelle. Le partenaire peut directement connecter l'utilisateur sans nouvelle approbation.

### Compte utilisateur inexistant

Si la `user_key` est invalide, l'API renvoie `404 USER_NOT_FOUND`. Le partenaire doit inviter l'utilisateur à créer d'abord un compte Hora.

---

## API utilisateur (gestion de ses liaisons)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/me/links` | Liste de ses liaisons (optionnel `?status=pending`) |
| POST | `/api/me/links/:link_id/approve` | Approuver |
| POST | `/api/me/links/:link_id/reject` | Refuser |
| DELETE | `/api/me/links/:link_id` | Supprimer une liaison rejetée |

Toutes ces routes nécessitent `Authorization: Bearer <user_access_token>`.

Utiles pour construire une section « Mes connexions » dans l'app Hora mobile.

---

## Résumé visuel

```
┌──────────────┐      (1) POST /api/links { user_key }          ┌──────┐
│   Partenaire │ ──────────────────────────────────────────────►│ Hora │
│    (Ngoni)   │◄────────────────────────────────────────────── │      │
└──────┬───────┘       { link_id, consent_url, status=pending } └──────┘
       │
       │ (2) redirect vers consent_url
       ▼
┌──────────────┐         (3) login + approve/reject            ┌──────┐
│  Utilisateur │ ──────────────────────────────────────────────►│ Hora │
│  (navigateur)│                                                 │      │
└──────────────┘                                                 └──────┘

┌──────────────┐     (4) GET /api/links/:link_id (polling)      ┌──────┐
│   Partenaire │ ──────────────────────────────────────────────►│ Hora │
│    (Ngoni)   │◄──────────────────────────────────────────────  │      │
└──────────────┘               { status=approved }               └──────┘
```
