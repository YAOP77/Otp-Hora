-- User auth/session hardening:
-- - token_version supports server-side token invalidation on logout.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;
