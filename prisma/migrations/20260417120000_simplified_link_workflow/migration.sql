-- Simplified link workflow:
-- 1) Add user_key to users (human-readable identifier used by enterprises)
-- 2) Drop external_ref from identity_links (replaced by user_key lookup)
-- 3) Drop auth_events and auth_requests tables (status now lives on identity_links directly)

-- ─── 1) USERS.USER_KEY ───────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_key" TEXT;

-- Backfill existing users: format "x-{2 lowercase letters from prenom}-{6 hex chars from user_id}"
-- Fallback to "us" prefix if prenom has no usable letters.
UPDATE "users"
SET "user_key" = 'x-' ||
  CASE
    WHEN length(regexp_replace(lower("prenom"), '[^a-z]', '', 'g')) >= 2
      THEN substring(regexp_replace(lower("prenom"), '[^a-z]', '', 'g') FROM 1 FOR 2)
    WHEN length(regexp_replace(lower("prenom"), '[^a-z]', '', 'g')) = 1
      THEN regexp_replace(lower("prenom"), '[^a-z]', '', 'g') || 'x'
    ELSE 'us'
  END
  || '-' || substring(md5("user_id"::text) FROM 1 FOR 6)
WHERE "user_key" IS NULL;

ALTER TABLE "users" ALTER COLUMN "user_key" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_user_key_key" ON "users"("user_key");

-- ─── 2) DROP AUTH_EVENTS + AUTH_REQUESTS ─────────────────────────────
DROP TABLE IF EXISTS "auth_events" CASCADE;
DROP TABLE IF EXISTS "auth_requests" CASCADE;

-- ─── 3) IDENTITY_LINKS: drop external_ref and its unique constraint ──
DROP INDEX IF EXISTS "identity_links_company_id_external_ref_key";
ALTER TABLE "identity_links" DROP COLUMN IF EXISTS "external_ref";

-- Remove orphan links (pending links with no user_id — they belonged to the old flow)
DELETE FROM "identity_links" WHERE "user_id" IS NULL;

-- Enforce user_id NOT NULL (every link is now tied to a user from creation)
ALTER TABLE "identity_links" ALTER COLUMN "user_id" SET NOT NULL;
