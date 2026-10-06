# Enterprise Logistics Management System

ELMS is the internal logistics workspace for IMS Learning Resources. It enforces payment-aware dispatch, reconciles course transfers and tracks material movement across warehouse, courier and regional centres. There is no student portal or payment collection.

Built with **Next.js App Router, Fastify, TypeScript, Prisma and PostgreSQL**. Browser credentials stay out of localStorage. Real database transactions govern inventory and shipment decisions.

For a zero-cost manager demonstration, use [Render Free + Neon Free](docs/FREE_DEMO.md). The included `render.yaml` deploys one service with a free HTTPS URL, five demo roles and private fictional workbooks. No purchased domain or messaging API key is needed. Profile photos, bounded chat attachments and conversation search are included; database storage preserves uploads across free-host restarts.

## Implemented workflows

- Employee login, email recovery, password change, role-based access and immediate device-session revocation.
- Read-only student and payment visibility, scoped Admissions/Finance ingestion and duplicate-event handling.
- Payment-aware dispatch queue, verified postcode rules, bulk packing with atomic stock deduction, manager handover approval, unique AWB and shipment history.
- BOM definitions and material catalogue, multi-location stock, inward/adjustment ledger and low-stock visibility.
- Course/centre transfer requests, exact material-cost reconciliation, approval and authoritative enrolment synchronization.
- Failed delivery retry/RTO, one-time returns reconciliation and unusable-stock separation.
- Centre bulk orders, outward movement, inward confirmations and discrepancy detection.
- Print demand, vendor requisitions, partial receipts and order reconciliation.
- Durable SMS/WhatsApp outbox, editable templates, real Twilio adapter and visible provider-configuration failures.
- CSV, XLS/XLSX, structured PDF and DOCX preview/import, column normalization, error rows and duplicate detection.
- Live dashboard, search/filter/pagination, CSV/XLSX/PDF reporting, protected shipping manifests, audit history and account settings.
- IMS Excel studio: private saved workbooks, sheet tabs, configurable headers, sortable/filterable columns, grouped charts, blank/duplicate analysis, saved views and audited exports. Live dispatch and student grids sit beside workbook analysis.
- Employee profiles, manual availability, recent activity, internal channels, private direct messages, assigned tasks and exception desk.
- Warehouse packing station with limited student identifiers and atomic material deductions; 100/500/1000 selection across dispatch pages.
- Editorial/wabi-sabi workspace with self-hosted typography, collapsible navigation, smooth/reduced motion, configurable scrollbar visibility and recovery screens.
- Analysis workbench: five interactive chart types, pivot summaries, field statistics, multi-condition filters, reviewed text/PDF/DOCX extraction and private insight sharing. Employee inbox includes eligible updates and assigned tasks.

## Local setup

Requires Node.js 24, npm and PostgreSQL 15 or later (local verification used PostgreSQL 18). The database user running migrations needs extension-creation privileges for `pg_trgm`.

```powershell
npm ci
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/frontend/.env.example apps/frontend/.env
# Edit database URL, JWT secrets and first administrator credentials.
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
npm run dev
```

Open [local ELMS](http://localhost:3000). API listens on port 4000; Next.js proxies `/api/v1` to it. For a local first administrator without choosing credentials, run `node scripts/bootstrap-local.cjs` from `apps/backend`, then seed. That helper writes generated credentials to ignored `LOCAL_ACCESS.md`; it refuses production use. Existing employee passwords and business records are preserved by seed.

Configure centres, material items, course kits, courier partners/rules and verified serviceable postcodes. Send authoritative course fees/payment plans using Finance catalog ingestion, then student enrolments using Admissions and milestones using Finance. Operational tables intentionally start empty. Reconcile the queue after defining new kits or updating serviceability.

Run `node scripts/create-role-logins.cjs` from `apps/backend` for local Manager, Dispatch Executive, Warehouse Staff and Viewer/Auditor accounts. Generated passwords are recorded in ignored `LOCAL_ACCESS.md`. Existing accounts are preserved. This helper refuses production use.

## Build and verification

```powershell
npm run lint
npm run build
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm audit --audit-level=moderate
```

Integration and browser runners create and destroy a randomly named temporary database. Their database account needs `CREATEDB`. They never reset the configured operational database. Browser tests start API/Next.js on ports 4000/3000, so stop local development servers before running them. Test fixture records live only in that temporary database.

Production startup without Docker: `npm start --workspace backend` and `npm start --workspace frontend`, after migrations, bootstrap and builds. Run both under a process supervisor behind HTTPS. Use environment values for development, test, staging and production; never copy production secrets into test files.

## Configuration

Required API values: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`. Defaults: `PORT=4000`, `NODE_ENV=development`, short access expiry and seven-day refresh expiry. First bootstrap: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, optional `ADMIN_NAME`. Department integration: `ADMISSIONS_API_KEY`, `FINANCE_API_KEY`, optional `INTEGRATION_ACTOR_EMAIL`. Recovery: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Messaging: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `TWILIO_WHATSAPP_FROM`. Frontend: server-only `API_INTERNAL_URL`. Docker: root `.env` also needs `POSTGRES_PASSWORD`, `ELMS_DOMAIN` and HTTPS `FRONTEND_URL`.

Optional provider variables may be omitted or empty. Templates and retention/print-buffer policy are stored in PostgreSQL; server credentials are never shown in settings.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture and data ownership](docs/ARCHITECTURE.md)
- [API and ingestion contract](docs/API.md)
- [Deployment and backup recovery](docs/DEPLOYMENT.md)
- [Security review](docs/SECURITY_REVIEW.md)
- [Performance review](docs/PERFORMANCE_REVIEW.md)
- [Release verification](docs/RELEASE.md)
- [Document coverage and employee workspace guide](docs/DOCUMENT_COVERAGE.md)

Provider credentials, authoritative postcode coverage, production hosting and approved business policies were not supplied. Those must be configured and validated before live operations. Courier API tracking is explicitly future scope in the source document; manual tracking is implemented. Scanned PDF OCR is excluded. Local tests passed with 50,004 students and 500-shipment packing; they do not certify sustained production capacity, uptime or legal compliance.

## Development and troubleshooting

Add business rules to the service layer, validate HTTP payloads with Zod, and commit audit records in the same transaction. Never expose Finance/Admissions mutations to employee routes. Create additive Prisma migrations; do not reset operational data or edit applied migrations. Run critical transaction tests when changing stock, transfers or eligibility. Format source using `npm run format`.

If login fails, check the bootstrap and API readiness; obsolete legacy sessions are intentionally revoked by the security migration. For request-origin errors, align `FRONTEND_URL` with the exact browser origin. For imports, split files over 1000 rows and use structured tables with recognized headers. A disabled packing action needs valid payment, verified serviceability and sufficient stock. Provider `WAITING_CONFIGURATION` is an actionable setup state, not a message-delivery success. Server error responses omit internal details; inspect safe server logs and readiness checks.
