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

IMPORTANT :
- Cette étape appartient à OTP Hora (pas à l’entreprise)

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
- statut

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

## API ENTREPRISE (STRICT)

### Authentification

POST /auth/request  
→ créer une demande  
→ retourne request_id  

GET /auth/status/:request_id  
→ retourne :
- pending
- approved
- rejected

---

## IMPORTANT SUR L’API

- L’entreprise ne doit PAS créer d’utilisateur OTP Hora
- L’entreprise ne doit PAS gérer les contacts ou appareils
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

## RÈGLES STRICTES DE DÉVELOPPEMENT

- Ne PAS ajouter de fonctionnalités
- Ne PAS modifier le flux métier
- Ne PAS déplacer la logique vers l’entreprise
- Respect strict du cahier des charges
- Ne PAS casser l’architecture existante
- Corriger uniquement les incohérences

---

## OBJECTIF FINAL

Construire une solution où :

- l’identité est centralisée dans OTP Hora
- l’entreprise ne fait que consommer l’API
- l’authentification se fait sans OTP
- l’utilisateur valide via application mobile