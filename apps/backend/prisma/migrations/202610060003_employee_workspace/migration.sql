CREATE TABLE "EmployeeProfile" (
  "employeeId" TEXT NOT NULL PRIMARY KEY,
  "jobTitle" TEXT NOT NULL DEFAULT '',
  "department" TEXT NOT NULL DEFAULT 'Logistics',
  "location" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "bio" TEXT NOT NULL DEFAULT '',
  "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "statusMessage" TEXT NOT NULL DEFAULT '',
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeProfile_availability_check" CHECK ("availability" IN ('AVAILABLE','BUSY','AWAY','OFFLINE'))
);
CREATE TABLE "TeamMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'operations',
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TeamMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TeamMessage_channel_createdAt_idx" ON "TeamMessage"("channel", "createdAt");
CREATE INDEX "TeamMessage_recipientId_createdAt_idx" ON "TeamMessage"("recipientId", "createdAt");
CREATE TABLE "WorkTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'TODO',
  "dueAt" TIMESTAMP(3),
  "reference" TEXT NOT NULL DEFAULT '',
  "assigneeId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkTask_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkTask_status_check" CHECK ("status" IN ('TODO','IN_PROGRESS','DONE')),
  CONSTRAINT "WorkTask_priority_check" CHECK ("priority" IN ('NORMAL','HIGH','URGENT'))
);
CREATE INDEX "WorkTask_assigneeId_status_dueAt_idx" ON "WorkTask"("assigneeId", "status", "dueAt");
CREATE TABLE "WorkbookDataset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sheets" JSONB NOT NULL,
  "view" JSONB NOT NULL DEFAULT '{}',
  "rowCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkbookDataset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WorkbookDataset_ownerId_createdAt_idx" ON "WorkbookDataset"("ownerId", "createdAt");
