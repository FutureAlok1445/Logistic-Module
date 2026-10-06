# Architecture

ELMS is one Next.js App Router application, one Fastify TypeScript API and one PostgreSQL database. Prisma defines the relational schema and checked-in migrations. The existing Turborepo manages package builds. No Redis or microservices are required.

The browser uses a same-origin `/api/v1` proxy. Short-lived access tokens stay in memory. Refresh tokens use HttpOnly, SameSite Strict cookies; only a SHA-256 token digest is stored in PostgreSQL. Access authentication validates the session, active employee and current role on every request, so revocation and permission changes take effect immediately. Cookie mutations require a matching Origin. Passwords use bcrypt cost 12; recovery uses random one-time tokens and SMTP.

Fastify route modules validate unknown inputs with Zod, check permissions and invoke framework-independent services. Business rules live in `domain.ts`, dispatch services and operations services. Transaction helpers use PostgreSQL serializable isolation and retry serialization conflicts up to three times. Stock deduction uses a conditional update as additional protection against overselling. Audit, ledger, tracking and notification outbox writes commit with business mutations. Database triggers prohibit modification of historical audit, stock ledger and tracking rows.

## Data ownership

Admissions pushes student identity and enrolment. Finance pushes milestones, payment plans, course fees and regional prices. Keys are independently scoped. Provider event IDs deduplicate retries. Employee forms cannot change upstream student or financial records. CSV/Excel/PDF/DOCX imports for protected records require both an authorised employee and the corresponding provider key. Import previews belong to their creator and may be committed once.

Transfer approval creates an operational resolution and awaits department sync. It does not execute refunds, change fees or mutate Finance records. On matching Admissions enrolment change, the system increments the enrolment version, holds old pending shipments, restores unshipped reserved material and clears stale milestones. Finance must send the new milestone state before any new material unlocks.

## Entity relationships

Employee has sessions, reset tokens and immutable audit entries. Student belongs to a course, centre and payment plan; has milestones, dispatches, notifications and transfers. Kit belongs to a course and has BOM lines referencing inventory items. Stock is unique per item/centre and has an immutable ledger. Dispatch is unique per student/kit/enrolment version, has a unique AWB and preserves packed quantities, unit costs, total material cost and delivery address. Return is unique per dispatch. Centre orders and print requisitions have separate line records and one-time receipts. Courier rules map destination state to priority. Pincodes require explicit serviceability.

Foreign keys and CHECK constraints reinforce validation. Deactivation replaces employee deletion. Mutable upstream identifiers remain stable; operational history retains snapshots. Monetary calculations use integer paise; database values use decimal types. Timestamps are UTC; filters interpret date boundaries in Asia/Kolkata, and UI formats INR.

## Imports and messaging

Parsers run in isolated Node subprocesses with a 15-second timeout and a 192 MB JavaScript heap limit. This isolates parser/native-library crashes from the API; the heap limit does not cap all native allocations. Multipart uploads are limited to 5 MB and one file; ZIP entry counts and expanded sizes are checked before document extraction. Files are not saved in a public web directory. Structured DOCX tables, CSV, XLS/XLSX and delimiter-based PDF tables are supported; scanned PDF OCR is outside current scope. Preview rows are removed on commit and abandoned previews expire after one day.

The notification outbox worker claims messages, sends through Twilio SMS or WhatsApp, records provider acceptance and retries up to five times with exponential backoff. `SENT` means provider accepted the message, not independently verified device delivery. Missing credentials produce `WAITING_CONFIGURATION`, never a simulated success. A crash after provider acceptance but before database confirmation may cause duplicate delivery; exactly-once delivery needs provider-supported idempotency or reconciliation.

## Operations

`/health` checks process liveness; `/ready` verifies PostgreSQL. The worker runs daily retention cleanup and expiry cleanup. Structured logs include safe error categories and failed-login identity hashes, never raw ORM exception bodies or credentials. Next.js private pages are marked noindex. All lists and exports are bounded. See performance review for measurement limits and deployment guide for recovery procedures.
