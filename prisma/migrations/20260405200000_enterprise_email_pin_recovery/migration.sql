-- Email de récupération entreprise + tokens reset PIN entreprise

ALTER TABLE "enterprise_accounts" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "enterprise_accounts" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_accounts_email_key" ON "enterprise_accounts"("email") WHERE "email" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "enterprise_pin_reset_tokens" (
    "reset_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enterprise_pin_reset_tokens_pkey" PRIMARY KEY ("reset_id")
);

CREATE INDEX IF NOT EXISTS "enterprise_pin_reset_tokens_company_id_idx" ON "enterprise_pin_reset_tokens"("company_id");
CREATE INDEX IF NOT EXISTS "enterprise_pin_reset_tokens_token_hash_idx" ON "enterprise_pin_reset_tokens"("token_hash");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enterprise_pin_reset_tokens_company_id_fkey'
  ) THEN
    ALTER TABLE "enterprise_pin_reset_tokens"
      ADD CONSTRAINT "enterprise_pin_reset_tokens_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "enterprise_accounts"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
