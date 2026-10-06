-- Application-level checks are reinforced by relational constraints.
ALTER TABLE "Stock" ADD CONSTRAINT "stock_nonnegative" CHECK (quantity >= 0 AND damaged >= 0);
ALTER TABLE "KitItem" ADD CONSTRAINT "kit_quantity_positive" CHECK (quantity > 0);
ALTER TABLE "InventoryItem" ADD CONSTRAINT "item_values_nonnegative" CHECK ("unitCost" >= 0 AND "lowStockThreshold" >= 0 AND pages >= 0);
ALTER TABLE "MilestoneStatus" ADD CONSTRAINT "milestone_values_valid" CHECK ("milestoneNumber" > 0 AND amount >= 0);
ALTER TABLE "CenterOrderLine" ADD CONSTRAINT "order_quantity_valid" CHECK (quantity > 0 AND ("receivedQuantity" IS NULL OR "receivedQuantity" >= 0) AND ("damagedQuantity" IS NULL OR "damagedQuantity" >= 0));
ALTER TABLE "PrintRequisitionLine" ADD CONSTRAINT "requisition_quantity_valid" CHECK (quantity > 0 AND "receivedQuantity" >= 0 AND "receivedQuantity" <= quantity);
ALTER TABLE "CenterOrder" ADD CONSTRAINT "order_source_fk" FOREIGN KEY ("fromCenterId") REFERENCES "Center"(id);
ALTER TABLE "CenterOrder" ADD CONSTRAINT "order_destination_fk" FOREIGN KEY ("toCenterId") REFERENCES "Center"(id);
ALTER TABLE "CenterOrderLine" ADD CONSTRAINT "order_item_fk" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"(id);
ALTER TABLE "PrintRequisition" ADD CONSTRAINT "requisition_center_fk" FOREIGN KEY ("centerId") REFERENCES "Center"(id);
ALTER TABLE "PrintRequisitionLine" ADD CONSTRAINT "requisition_item_fk" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"(id);
ALTER TABLE "Dispatch" ADD CONSTRAINT "dispatch_warehouse_fk" FOREIGN KEY ("warehouseId") REFERENCES "Center"(id);
CREATE INDEX IF NOT EXISTS "idx_audit_timestamp" ON "AuditLog"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_students_name_trgm" ON "Student" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_students_mobile_trgm" ON "Student" USING gin (mobile gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_transfer_status" ON "Transfer"(status,"requestDate");

CREATE OR REPLACE FUNCTION elms_immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ELMS audit records are append only';
END;
$$;
CREATE TRIGGER "audit_no_update_delete" BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION elms_immutable_audit();
CREATE TRIGGER "ledger_no_update_delete" BEFORE UPDATE OR DELETE ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION elms_immutable_audit();
CREATE TRIGGER "tracking_no_update_delete" BEFORE UPDATE OR DELETE ON "TrackingEvent" FOR EACH ROW EXECUTE FUNCTION elms_immutable_audit();

-- Legacy sessions used plaintext refresh tokens and have no session ID claim.
DELETE FROM "Session";
