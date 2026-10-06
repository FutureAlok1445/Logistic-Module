ALTER TABLE "EmployeeProfile" ADD COLUMN "avatarFileId" TEXT;
CREATE TABLE "EmployeeFile" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "messageId" TEXT,
  "kind" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeFile_size_check" CHECK ("size" > 0 AND "size" <= 2097152 AND octet_length("content") = "size"),
  CONSTRAINT "EmployeeFile_kind_check" CHECK (("kind" = 'AVATAR' AND "messageId" IS NULL AND "size" <= 524288) OR ("kind" = 'MESSAGE' AND "messageId" IS NOT NULL))
);
CREATE INDEX "EmployeeFile_ownerId_kind_idx" ON "EmployeeFile"("ownerId", "kind");
CREATE INDEX "EmployeeFile_messageId_idx" ON "EmployeeFile"("messageId");
ALTER TABLE "EmployeeFile" ADD CONSTRAINT "EmployeeFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeFile" ADD CONSTRAINT "EmployeeFile_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TeamMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
