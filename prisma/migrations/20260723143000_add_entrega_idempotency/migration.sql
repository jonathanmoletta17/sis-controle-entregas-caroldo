ALTER TABLE "Entrega"
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Entrega_idempotencyKey_key"
ON "Entrega"("idempotencyKey");
