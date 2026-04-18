-- 1) identity_links: add created_at and updated_at for traceability
ALTER TABLE "identity_links"
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "identity_links"
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "identity_links_user_id_created_at_idx"
  ON "identity_links"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "identity_links_company_id_created_at_idx"
  ON "identity_links"("company_id", "created_at" DESC);

-- 2) enterprise_accounts: add api_key_encrypted (AES-256-GCM) so we can
-- display the key in the account page. The bcrypt hash stays in api_key
-- for verification. Old accounts keep NULL until they rotate.
ALTER TABLE "enterprise_accounts"
  ADD COLUMN IF NOT EXISTS "api_key_encrypted" TEXT;

-- 3) Regenerate user_keys to the new shorter format (x-XX-YYYYY, 10 chars).
-- We use a deterministic derivation from user_id so the migration is idempotent
-- and doesn't silently change keys across re-runs on the same DB.
-- Format: lowercase first 2 letters of prenom (fallback "us") + dash + 5 chars
-- base36 from md5(user_id). base36 is a subset of base62 and matches the app regex.
UPDATE "users"
SET "user_key" = 'x-' ||
  CASE
    WHEN length(regexp_replace(lower("prenom"), '[^a-z]', '', 'g')) >= 2
      THEN substring(regexp_replace(lower("prenom"), '[^a-z]', '', 'g') FROM 1 FOR 2)
    WHEN length(regexp_replace(lower("prenom"), '[^a-z]', '', 'g')) = 1
      THEN regexp_replace(lower("prenom"), '[^a-z]', '', 'g') || 'x'
    ELSE 'us'
  END
  || '-' || substring(md5("user_id"::text) FROM 1 FOR 5)
WHERE length("user_key") > 10;
