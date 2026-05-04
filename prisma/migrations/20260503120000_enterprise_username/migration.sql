-- Nom d'utilisateur public pour les comptes entreprise (comme côté utilisateur).
ALTER TABLE "enterprise_accounts" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "enterprise_accounts_username_key" ON "enterprise_accounts"("username");
