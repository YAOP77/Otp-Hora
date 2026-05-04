# 🛠️ Backend - Nouvelles Fonctionnalités de Sécurité

Ce document décrit les modifications apportées à l'API et à la base de données.

### 🧠 Logique Développée
1.  **Identité Utilisateur** :
    *   Ajout du champ `username` unique.
    *   Séparation entre l'identifiant public (`username`) et l'ID technique interne (UUID).
    *   Le numéro de téléphone est désormais figé après l'inscription.
2.  **Sécurité & Récupération** :
    *   **Questions de sécurité** : Stockage de 5 questions avec hachage **bcrypt** des réponses pour une confidentialité maximale.
    *   **Flux de récupération** : Nouvelle API `/api/users/pin-recovery/questions` et `/api/users/pin-recovery/confirm`.
3.  **Gestion des Sessions** :
    *   Traçage des appareils avec IP et User-Agent.
    *   Capacité de désactiver une session à distance via `/api/users/me/devices/:device_id/deactivate`.

### 🏢 Module Back-Office (Administration)
1.  **Endpoints Administratifs** :
    *   `GET /api/back-office/me` : Vérification du profil admin et des droits d'accès.
    *   `GET /api/back-office/admins` : Liste complète des comptes administrateurs.
    *   `POST /api/back-office/admins` : Création de nouveaux comptes administrateurs avec hachage de mot de passe.
    *   `GET /api/back-office/users` : Liste enrichie des utilisateurs avec détails des contacts et appareils.
    *   `GET /api/back-office/enterprises` : Liste des entreprises (`enterprise_accounts` : `company_id`, `nom_entreprise`, `username`, `email`, `email_verified_at`, `status`, `phone_e164`, `deleted_at` — sans exposer `api_key`).
2.  **Modération & Sécurité** :
    *   `PATCH /api/back-office/users/:user_id/status` : Changement d'état (active, suspended, blocked).
    *   `POST /api/back-office/users/:user_id/devices/deactivate` : Déconnexion forcée de toutes les sessions d'un utilisateur.
3.  **Authentification Admin** :
    *   Nouveau flux de connexion dédié `POST /api/back-office/login` indépendant du flux utilisateur standard.

### 👤 Utilisateur & liaisons (mises à jour)
1.  **Profil & PATCH** :
    *   `PATCH /api/users/:user_id` : prise en charge optionnelle du **`username`** (unicité, normalisation minuscules, même règles que l’inscription).
    *   `GET` profil : champ **`username`** inclus dans la sélection Prisma ; **`user_key`** toujours en base pour les intégrations.
2.  **Liaisons entreprise** (`GET /api/enterprises/me/links`) :
    *   Objet `user` enrichi avec **`username`** (la `user_key` peut rester dans le JSON pour compatibilité ; l’UI grand public n’affiche que le nom d’utilisateur).

### 🏢 Comptes entreprise (mises à jour)
1.  **Schéma** : champ optionnel unique **`username`** sur `enterprise_accounts` (migration Prisma dédiée).
2.  **Inscription** : `username` **obligatoire**, contrôle d’unicité ; réponse `company` inclut le `username`.
3.  **Profil / session** : `GET/PATCH` entreprise authentifiée exposent et permettent de modifier le **`username`** (même logique de conflit que côté utilisateur).
4.  **Clé API** : inchangée côté API (récupération / rotation) ; l’absence d’affichage relève uniquement du front portail entreprise.

### 💡 Recommandations
- **Base de données** : Exécutez `npx prisma migrate deploy` (ou `db push` en dev) dès que PostgreSQL est prêt, notamment après l’ajout de **`enterprise_accounts.username`**.
- **Sécurité Admin** : Toutes les routes `/api/back-office/*` (sauf login) sont protégées par le middleware `requireAdminAccessToken` qui vérifie explicitement le rôle `admin`.
- **Audit** : Pour une traçabilité complète, envisagez d'implémenter le module `admin_logs` pour enregistrer chaque action effectuée via le back-office.
