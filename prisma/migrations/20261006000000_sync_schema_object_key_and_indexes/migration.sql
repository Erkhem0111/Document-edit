-- schema.prisma-д өмнө нь migration-гүйгээр (db push-оор) орсон өөрчлөлтүүдийг
-- migration түүхэнд нэмнэ. Хуучин өгөгдөлтэй DB дээр ч алдаагүй ажиллахаар бичсэн.

-- ─── GlobalRole: MANAGER-ийг хасна ──────────────────────────────────────────
-- MANAGER эрхтэй хэрэглэгч байвал ENGINEER болгоно (text-ээр харьцуулсан тул
-- MANAGER утга аль хэдийн байхгүй enum дээр ч алдаа гарахгүй).
UPDATE "User" SET "role" = 'ENGINEER' WHERE "role"::text = 'MANAGER';

BEGIN;
CREATE TYPE "GlobalRole_new" AS ENUM ('ADMIN', 'ENGINEER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "GlobalRole_new" USING ("role"::text::"GlobalRole_new");
ALTER TYPE "GlobalRole" RENAME TO "GlobalRole_old";
ALTER TYPE "GlobalRole_new" RENAME TO "GlobalRole";
DROP TYPE "GlobalRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ENGINEER';
COMMIT;

-- ─── FileVersion.objectKey ──────────────────────────────────────────────────
-- Эхлээд хоосон байж болохоор нэмээд, хуучин мөрүүдийг R2-ийн анхны key
-- бүтцээр (projects/<projectId>/<fileId>/v<N>) бөглөж, дараа нь NOT NULL болгоно.
ALTER TABLE "FileVersion" ADD COLUMN IF NOT EXISTS "objectKey" TEXT;

UPDATE "FileVersion" v
SET "objectKey" = 'projects/' || f."projectId" || '/' || v."fileId" || '/v' || v."versionNumber"
FROM "ProjectFile" f
WHERE f."id" = v."fileId" AND v."objectKey" IS NULL;

ALTER TABLE "FileVersion" ALTER COLUMN "objectKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "FileVersion_objectKey_key" ON "FileVersion"("objectKey");

-- ─── Хурдны index-үүд ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Comment_fileId_parentId_createdAt_idx" ON "Comment"("fileId", "parentId", "createdAt");
CREATE INDEX IF NOT EXISTS "Project_visibility_isArchived_trashedAt_updatedAt_idx" ON "Project"("visibility", "isArchived", "trashedAt", "updatedAt");
CREATE INDEX IF NOT EXISTS "ProjectFile_projectId_updatedAt_idx" ON "ProjectFile"("projectId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ProjectFile_projectId_folderId_idx" ON "ProjectFile"("projectId", "folderId");
CREATE INDEX IF NOT EXISTS "ProjectMember_userId_role_idx" ON "ProjectMember"("userId", "role");
CREATE INDEX IF NOT EXISTS "Task_projectId_updatedAt_idx" ON "Task"("projectId", "updatedAt");
