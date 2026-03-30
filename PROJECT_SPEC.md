# OTP HORA - SPÉCIFICATION BACKEND

## OBJECTIF
Construire une API d’authentification sécurisée permettant :
- la gestion de l’identité des utilisateurs
- l’association des utilisateurs aux entreprises
- la gestion des demandes d’authentification
- le système de validation

---

## STACK TECHNIQUE
- Node.js (Express)
- PostgreSQL
- Prisma ORM
- Firebase (plus tard pour les notifications)

---

## CONCEPT CENTRAL

Le système remplace les codes OTP par une validation via notification push.

Flux :
1. L’utilisateur tente de se connecter sur l’entreprise (NGONI)
2. L’entreprise envoie une requête à l’API OTP Hora
3. OTP Hora crée une demande d’authentification
4. L’utilisateur reçoit une notification
5. L’utilisateur approuve ou rejette
6. L’entreprise vérifie le statut

---

## ACTEURS

- **Utilisateur**
  - Détient une identité dans OTP Hora (`users`) et des moyens de contact (`user_contacts`) et appareils (`user_devices`).
  - Reçoit la demande d’authentification et décide d’**approuver** ou **rejeter**.
- **Système OTP Hora**
  - Expose l’API, crée et suit les demandes (`auth_requests`), journalise les actions (`auth_events`).
  - Gère les liens d’identité avec les entreprises (`identity_links`).
- **Entreprise (NGONI)**
  - Intègre l’API OTP Hora via un compte entreprise (`enterprise_accounts`) et une **API key**.
  - Déclenche une demande d’authentification et consulte son statut.
- **Administrateur**
  - Administre les statuts (ex. suspension/blocage) des entités existantes via leurs champs `status` (utilisateurs, entreprises, liens, etc.).
  - Supervise et audite les événements d’authentification via `auth_events`.

---

## FLUX FONCTIONNELS

Les flux ci-dessous décrivent le comportement attendu **sans ajouter de logique métier** au-delà de la spécification existante.

### Inscription utilisateur
1. Création d’un utilisateur dans `users` avec `name` et `status`.
2. Ajout d’un contact dans `user_contacts` (ex. `phone_number`).
3. Vérification du contact via `verified_at` (si/au moment où le numéro est validé).

### Premier lien avec une entreprise
1. Création (ou existence) d’un compte entreprise dans `enterprise_accounts` avec `nom_entreprise`, `api_key`, `status`.
2. Création d’un lien d’identité dans `identity_links` entre :
   - `user_id` (OTP Hora)
   - `company_id` (entreprise)
   - `external_ref` (référence utilisateur côté entreprise)
   - `status`
3. Règles à respecter :
   - une identité unique par utilisateur
   - un lien par entreprise et par utilisateur

### Demande d’authentification
1. L’entreprise appelle l’API OTP Hora (authentifiée par API key).
2. OTP Hora crée une entrée `auth_requests` liée à `identity_links` (`link_id`), avec :
   - `status`
   - `expires_at` (expiration obligatoire)
3. OTP Hora journalise l’action dans `auth_events` (ex. création de demande).
4. L’utilisateur reçoit une notification (Firebase mentionné « plus tard »).

### Validation (approuver / rejeter)
1. L’utilisateur approuve ou rejette la demande.
2. OTP Hora met à jour le `status` de `auth_requests`.
3. OTP Hora journalise l’action dans `auth_events` avec :
   - `action`
   - `created_at`
4. L’entreprise consulte le statut pour finaliser l’authentification côté NGONI.

### Processus de récupération (basique)
1. Un moyen de récupération est enregistré dans `recovery_methods` :
   - `user_id`, `method_type`, `status`
2. Les changements d’état (activation/suspension) se font via les champs `status` existants.

---

## TABLES DE BASE DE DONNÉES

### users
- user_id
- name
- status

### user_contacts
- contact_id
- user_id
- phone_number
- verified_at

### user_devices
- device_id
- user_id
- device_fingerprint
- trusted

### enterprise_accounts
- company_id
- nom_entreprise
- api_key
- status

### identity_links
- link_id
- company_id
- user_id
- external_ref
- status

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

### recovery_methods
- recovery_id
- user_id
- method_type
- status

---

## ENDPOINTS API

Cette liste est la référence des endpoints nécessaires et reste alignée avec la structure de données et les flux ci-dessus.

### Gestion utilisateurs
- POST /users

### Gestion entreprises
- POST /enterprises

### Liens d’identité (entreprise ↔ utilisateur)
- POST /links

### Authentification
- POST /auth/request
- GET /auth/status/:id
- POST /auth/approve/:id
- POST /auth/reject/:id

---

## RÈGLES

- Une identité unique par utilisateur
- Un lien par entreprise et par utilisateur
- Aucun code OTP n’est stocké
- Chaque requête doit expirer
- Toutes les actions doivent être journalisées

---

## EXIGENCES DE SÉCURITÉ

- **Authentification par API key (entreprises)**
  - Les appels « entreprise → OTP Hora » doivent être authentifiés via `enterprise_accounts.api_key`.
- **Expiration des demandes**
  - `auth_requests.expires_at` doit être appliqué : une demande expirée ne peut plus être validée.
- **Journalisation**
  - Toutes les actions d’authentification doivent produire des entrées `auth_events` (ex. création, approbation, rejet).
- **Blocage / suspension**
  - La capacité de bloquer/suspendre s’appuie sur les champs `status` déjà présents (utilisateurs, entreprises, liens, demandes, méthodes de récupération).

---

## ARCHITECTURE

Structure modulaire :

- controller → gère HTTP
- service → logique métier
- repository → base de données

### Détails

- **Structure modulaire**
  - Organisation par module fonctionnel (ex. `users`, `enterprises`, `links`, `auth`, `recovery`).
- **controller**
  - Valide l’entrée HTTP (format, présence), orchestre la réponse HTTP (status code + payload).
- **service**
  - Implémente la logique métier (règles, statuts, expiration, journalisation).
- **repository**
  - Accès aux données via Prisma (requêtes, transactions si nécessaire).
- **middleware**
  - Couche transversale : sécurité (helmet), CORS, logs (morgan), parsing JSON, authentification API key entreprise, gestion d’erreurs.

---

## IMPORTANT

- Ne PAS ajouter de fonctionnalités supplémentaires non définies ici
- Garder la logique simple et propre
- Respecter la séparation des responsabilités

Ce document doit être strictement respecté pendant le développement.

