-- Багаж, тусгай зөвшөөрлийн бүртгэл (шинэ хүснэгт — байгаа өгөгдөлд нөлөөлөхгүй)
CREATE TYPE "EquipmentKind" AS ENUM ('INSTRUMENT', 'PERMIT');

CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "kind" "EquipmentKind" NOT NULL,
    "name" TEXT NOT NULL,
    "serial" TEXT,
    "holder" TEXT,
    "validFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Equipment_kind_expiresAt_idx" ON "Equipment"("kind", "expiresAt");
