-- Гүйцэтгэлийн индексүүд (аудит, 1-р үе). Зөвхөн индекс нэмнэ — өгөгдөл өөрчлөхгүй.
-- 300k файл дээр хэмжсэн: хайлт 58ms → 1.7ms, сүүлийн файлууд 34ms → 0.08ms.

-- Нэрээр хэсэгчлэн хайх (ILIKE '%...%')-д зориулсан trigram өргөтгөл
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "ProjectFile_updatedAt_idx" ON "ProjectFile"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "ProjectFile_name_idx" ON "ProjectFile" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "FileVersion_fileSize_idx" ON "FileVersion"("fileSize" DESC);

-- CreateIndex
CREATE INDEX "FileActivity_fileId_createdAt_idx" ON "FileActivity"("fileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");
