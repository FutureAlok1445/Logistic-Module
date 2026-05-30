-- This is an empty migration.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_students_search ON "Student" USING gin(to_tsvector('english', "name" || ' ' || "mobile" || ' ' || "id"));
CREATE INDEX idx_dispatch_queue ON "Dispatch"("status", "createdAt" DESC) WHERE "status" IN ('QUEUED', 'ADDRESS_FLAGGED', 'PACKED');
CREATE INDEX idx_milestone_pending ON "MilestoneStatus"("studentId", "paid") WHERE "paid" = false;
CREATE INDEX idx_audit_timestamp ON "AuditLog"("timestamp" DESC);