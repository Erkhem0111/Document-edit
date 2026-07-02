-- CreateEnum
CREATE TYPE "ProjectVisibility" AS ENUM ('PUBLIC', 'SHARED', 'PRIVATE', 'REFERENCE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "trashedAt" TIMESTAMP(3),
ADD COLUMN     "visibility" "ProjectVisibility" NOT NULL DEFAULT 'PRIVATE';
