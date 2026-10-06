-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DeliveryMode" ADD VALUE 'SPEED_POST';
ALTER TYPE "DeliveryMode" ADD VALUE 'CENTER_TO_CENTER';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "fee" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Dispatch" ADD COLUMN     "addressSnapshot" JSONB,
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "enrollmentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "materialCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "packedItems" JSONB,
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "Kit" ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "milestoneNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "weightKg" DECIMAL(10,3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "providerId" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "enrollmentVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TrackingEvent" ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "fromCourseId" TEXT,
ADD COLUMN     "materialCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "targetFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "toCourseId" TEXT,
ADD COLUMN     "usableCredit" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePrice" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "CoursePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitItem" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "KitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "damaged" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "damaged" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierRule" (
    "id" TEXT NOT NULL,
    "courierPartnerId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CourierRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pincode" (
    "code" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "serviceable" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pincode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ReturnRecord" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "condition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterOrder" (
    "id" TEXT NOT NULL,
    "fromCenterId" TEXT NOT NULL,
    "toCenterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "boxes" INTEGER NOT NULL DEFAULT 1,
    "awbNumber" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "CenterOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER,
    "damagedQuantity" INTEGER,

    CONSTRAINT "CenterOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintRequisition" (
    "id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintRequisitionLine" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PrintRequisitionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "event" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "content" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("event")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePrice_courseId_centerId_key" ON "CoursePrice"("courseId", "centerId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "KitItem_kitId_itemId_key" ON "KitItem"("kitId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_itemId_centerId_key" ON "Stock"("itemId", "centerId");

-- CreateIndex
CREATE INDEX "StockMovement_centerId_itemId_createdAt_idx" ON "StockMovement"("centerId", "itemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourierRule_state_priority_key" ON "CourierRule"("state", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRecord_dispatchId_key" ON "ReturnRecord"("dispatchId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterOrderLine_orderId_itemId_key" ON "CenterOrderLine"("orderId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintRequisitionLine_requisitionId_itemId_key" ON "PrintRequisitionLine"("requisitionId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispatch_studentId_kitId_enrollmentVersion_key" ON "Dispatch"("studentId", "kitId", "enrollmentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Dispatch_awbNumber_key" ON "Dispatch"("awbNumber");

-- CreateIndex
CREATE INDEX "NotificationLog_status_nextAttemptAt_idx" ON "NotificationLog"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "Kit" ADD CONSTRAINT "Kit_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrice" ADD CONSTRAINT "CoursePrice_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrice" ADD CONSTRAINT "CoursePrice_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitItem" ADD CONSTRAINT "KitItem_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitItem" ADD CONSTRAINT "KitItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierRule" ADD CONSTRAINT "CourierRule_courierPartnerId_fkey" FOREIGN KEY ("courierPartnerId") REFERENCES "CourierPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterOrderLine" ADD CONSTRAINT "CenterOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CenterOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintRequisitionLine" ADD CONSTRAINT "PrintRequisitionLine_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "PrintRequisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

