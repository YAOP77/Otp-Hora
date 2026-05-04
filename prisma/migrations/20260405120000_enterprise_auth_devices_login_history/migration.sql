-- Enterprise app auth (phone + PIN), devices, login history; user roles and device metadata.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';

ALTER TABLE "user_devices"
  ADD COLUMN IF NOT EXISTS "device_name" TEXT,
  ADD COLUMN IF NOT EXISTS "user_agent" TEXT,
  ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3);

ALTER TABLE "enterprise_accounts"
  ADD COLUMN IF NOT EXISTS "phone_e164" TEXT,
  ADD COLUMN IF NOT EXISTS "pin_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_accounts_phone_e164_key" ON "enterprise_accounts"("phone_e164");

CREATE TABLE IF NOT EXISTS "enterprise_devices" (
    "device_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "device_fingerprint" TEXT NOT NULL,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "device_name" TEXT,
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "enterprise_devices_pkey" PRIMARY KEY ("device_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_devices_company_id_device_fingerprint_key" ON "enterprise_devices"("company_id", "device_fingerprint");

CREATE TABLE IF NOT EXISTS "user_login_history" (
    "history_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_name" TEXT,
    "user_agent" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_login_history_pkey" PRIMARY KEY ("history_id")
);

CREATE TABLE IF NOT EXISTS "enterprise_login_history" (
    "history_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "device_name" TEXT,
    "user_agent" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enterprise_login_history_pkey" PRIMARY KEY ("history_id")
);

CREATE INDEX IF NOT EXISTS "user_login_history_user_id_connected_at_idx" ON "user_login_history"("user_id", "connected_at");

CREATE INDEX IF NOT EXISTS "enterprise_login_history_company_id_connected_at_idx" ON "enterprise_login_history"("company_id", "connected_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enterprise_devices_company_id_fkey'
  ) THEN
    ALTER TABLE "enterprise_devices"
      ADD CONSTRAINT "enterprise_devices_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "enterprise_accounts"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_login_history_user_id_fkey'
  ) THEN
    ALTER TABLE "user_login_history"
      ADD CONSTRAINT "user_login_history_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enterprise_login_history_company_id_fkey'
  ) THEN
    ALTER TABLE "enterprise_login_history"
      ADD CONSTRAINT "enterprise_login_history_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "enterprise_accounts"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
