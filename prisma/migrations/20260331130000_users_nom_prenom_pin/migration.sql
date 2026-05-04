-- Spec §1 inscription : nom, prénom, PIN (hash bcrypt). V1 : pas de biométrie côté API.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = ''public'' AND table_name = ''users'' AND column_name = ''name''
  ) THEN
    ALTER TABLE "users" RENAME COLUMN "name" TO "nom";
  END IF;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "prenom" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pin_hash" TEXT NOT NULL DEFAULT '';
