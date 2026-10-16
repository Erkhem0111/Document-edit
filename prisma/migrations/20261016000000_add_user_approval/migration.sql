-- Шинэ хэрэглэгч шууд нэвтэрнэ, админ дараа нь шийднэ.
-- Одоо байгаа хэрэглэгчид зөвшөөрөгдсөн хэвээр (default true).
ALTER TABLE "User" ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT true;

-- Хуучин дүрмээр "хүлээгдэж буй" (нэг ч удаа нэвтрээгүй, идэвхгүй) хүмүүс
-- шинэ дүрэмд шилжинэ: нэвтэрч болно, гэхдээ админ зөвшөөрөх хүртэл хязгаартай
UPDATE "User" SET "isActive" = true, "isApproved" = false
WHERE "isActive" = false AND "lastLoginAt" IS NULL;
