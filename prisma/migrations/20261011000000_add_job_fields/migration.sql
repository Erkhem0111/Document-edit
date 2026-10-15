-- Ажлын самбар: төсөлд ажлын мэдээлэл (бүгд nullable — байгаа өгөгдөлд нөлөөлөхгүй)
CREATE TYPE "JobStage" AS ENUM ('ORDER', 'FIELD', 'PROCESSING', 'REVIEW', 'DELIVERED');
CREATE TYPE "JobType" AS ENUM ('CADASTRE', 'TOPOGRAPHIC', 'ENGINEERING', 'OTHER');

ALTER TABLE "Project"
  ADD COLUMN "jobStage" "JobStage",
  ADD COLUMN "jobType" "JobType",
  ADD COLUMN "jobClient" TEXT,
  ADD COLUMN "jobDueDate" TIMESTAMP(3),
  ADD COLUMN "jobDeliveredAt" TIMESTAMP(3);

CREATE INDEX "Project_jobStage_idx" ON "Project"("jobStage");
