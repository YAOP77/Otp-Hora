-- Baseline migration for OTP Hora current schema.
-- This migration creates all tables required by prisma/schema.prisma.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "users" (
  "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nom" TEXT NOT NULL,
  "prenom" TEXT NOT NULL,
  "pin_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "enterprise_accounts" (
  "company_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nom_entreprise" TEXT NOT NULL,
  "api_key" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  CONSTRAINT "enterprise_accounts_pkey" PRIMARY KEY ("company_id")
);

CREATE TABLE "identity_links" (
  "link_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "user_id" UUID,
  "external_ref" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  CONSTRAINT "identity_links_pkey" PRIMARY KEY ("link_id")
);

CREATE TABLE "auth_requests" (
  "request_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "link_id" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_requests_pkey" PRIMARY KEY ("request_id")
);

CREATE TABLE "auth_events" (
  "event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "request_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_events_pkey" PRIMARY KEY ("event_id")
);

CREATE TABLE "user_contacts" (
  "contact_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "phone_number" TEXT NOT NULL,
  "verified_at" TIMESTAMP(3),
  CONSTRAINT "user_contacts_pkey" PRIMARY KEY ("contact_id")
);

CREATE TABLE "user_devices" (
  "device_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "device_fingerprint" TEXT NOT NULL,
  "trusted" BOOLEAN NOT NULL,
  CONSTRAINT "user_devices_pkey" PRIMARY KEY ("device_id")
);

CREATE TABLE "recovery_methods" (
  "recovery_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "method_type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  CONSTRAINT "recovery_methods_pkey" PRIMARY KEY ("recovery_id")
);

CREATE UNIQUE INDEX "identity_links_user_id_company_id_key" ON "identity_links"("user_id", "company_id");
CREATE UNIQUE INDEX "identity_links_company_id_external_ref_key" ON "identity_links"("company_id", "external_ref");

ALTER TABLE "identity_links"
  ADD CONSTRAINT "identity_links_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "enterprise_accounts"("company_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity_links"
  ADD CONSTRAINT "identity_links_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_requests"
  ADD CONSTRAINT "auth_requests_link_id_fkey"
  FOREIGN KEY ("link_id") REFERENCES "identity_links"("link_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_events"
  ADD CONSTRAINT "auth_events_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "auth_requests"("request_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_contacts"
  ADD CONSTRAINT "user_contacts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_devices"
  ADD CONSTRAINT "user_devices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recovery_methods"
  ADD CONSTRAINT "recovery_methods_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
