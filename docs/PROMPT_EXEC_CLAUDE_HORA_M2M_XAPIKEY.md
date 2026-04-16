## Prompt d’exécution (à donner à Claude)

Tu dois implémenter le workflow Hora **en mode partenaire serveur-à-serveur**, en utilisant **uniquement `x-api-key`** côté entreprise.

### Source de vérité
- `docs/PROMPT_CLAUDE_HORA_AUTH_WORKFLOW.md`
- `docs/NEW_AUTH_FLOW_SIMPLE.md`

### Règles strictes
- **Entreprise = `x-api-key` uniquement** (pas de Bearer company dans ton design Ngoni).
- **Utilisateur = redirection vers** `GET https://otp-hora.onrender.com/flow/consent?...` (ne pas faire appeler `links/confirm` / `approve` / `reject` directement par le mobile).
- Ne jamais mettre un token user dans le body.
- Ne pas inventer d’endpoints Hora (pas de `GET /api/links`).

### Tâches
1) Côté Ngoni, stocker `HORA_API_KEY` en secret serveur et l’envoyer à Hora via header `x-api-key`.
2) Implémenter le flux :
   - `POST /api/links` (x-api-key) → `link_id`
   - `POST /api/auth/request` (x-api-key) → `request_id`
   - redirection user → `/flow/consent?link_id=...&request_id=...&callback_url=...`
   - endpoint Ngoni de callback qui traite `hora_status` et finalise register/login.
3) Mettre à jour Postman + doc Ngoni.

### Preuves attendues
- Une table “route Ngoni → route Hora”
- 1 parcours “approved” et 1 “rejected” en smoke test

