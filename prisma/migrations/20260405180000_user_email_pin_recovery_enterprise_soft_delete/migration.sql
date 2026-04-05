-- User email + PIN reset tokens; enterprise soft delete (deleted_at)

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email") WHERE "email" IS NOT NULL;

ALTER TABLE "enterprise_accounts" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "pin_reset_tokens" (
    "reset_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pin_reset_tokens_pkey" PRIMARY KEY ("reset_id")
);

CREATE INDEX IF NOT EXISTS "pin_reset_tokens_user_id_idx" ON "pin_reset_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "pin_reset_tokens_token_hash_idx" ON "pin_reset_tokens"("token_hash");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pin_reset_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE "pin_reset_tokens"
      ADD CONSTRAINT "pin_reset_tokens_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
