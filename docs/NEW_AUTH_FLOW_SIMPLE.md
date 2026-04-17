# Workflow Hora simplifie (id_user + status)

Le workflow de liaison/authentification est base sur 3 champs:

- `x-api-key` (auth entreprise)
- `id_user` (identifiant utilisateur fourni par Hora, ex: `x-th-a1`)
- `status` (`pending`, `approved`, `rejected`)

---

## Contrat entreprise

### 1) Initialiser une demande

`POST /api/auth/request` avec `x-api-key`.

Body:

```json
{
  "id_user": "x-th-a1",
  "status": "pending"
}
```

Reponse:

- `request_id`
- `status: "pending"`
- `validation_url` (lien Hora a ouvrir pour que l'utilisateur valide)

### 2) Polling de statut

`POST /api/auth/status` avec `x-api-key`, en renvoyant le meme payload:

```json
{
  "id_user": "x-th-a1",
  "status": "pending"
}
```

Hora renvoie:

- `pending` -> attendre
- `approved` -> autoriser register/login cote reseau social
- `rejected` -> refuser l'authentification

---

## Contrat utilisateur

1. L'utilisateur partage son `id_user` a l'application tierce.
2. Hora expose un `validation_url`.
3. Sur cette page Hora, l'utilisateur confirme ou refuse la liaison.
4. Hora met a jour le statut de la demande (`approved` ou `rejected`).
5. L'entreprise recupere ce statut via `POST /api/auth/status`.

---

## Notes

- `GET /api/auth/status/:request_id` reste disponible pour compatibilite legacy.
- Les routes `/api/auth/approve/:request_id` et `/api/auth/reject/:request_id` restent utilisees cote Hora/utilisateur.

