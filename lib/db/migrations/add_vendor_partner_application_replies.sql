ALTER TABLE "vendor_partner_applications"
ADD COLUMN IF NOT EXISTS "thread_token" text;

CREATE TABLE IF NOT EXISTS "vendor_partner_application_replies" (
  "id" serial PRIMARY KEY,
  "application_id" integer NOT NULL,
  "direction" text NOT NULL,
  "body" text NOT NULL,
  "sender_user_id" text,
  "sender_email" text,
  "sender_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "vendor_partner_application_replies_application_id_idx"
ON "vendor_partner_application_replies" ("application_id");
