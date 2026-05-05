-- Add nullable first so existing production users can migrate safely.
ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT;

CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
