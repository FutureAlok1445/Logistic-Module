# Release verification

Verified locally on October 6, 2026 with Node.js 24, PostgreSQL 18 and Chromium. The implementation uses Next.js App Router and Fastify with TypeScript, Prisma and PostgreSQL. Operational data was not replaced with test fixtures.

## Verification evidence

- TypeScript/API validation and frontend ESLint pass.
- Production builds for API, Next.js and shared types pass.
- Nine domain tests pass for exact monetary reconciliation, tracking transitions, address/serviceability, permissions, import normalization, formula-safe exports, text parsing, filter semantics and column statistics.
- Twenty-six integration tests pass in a newly created temporary database. Coverage includes scoped department ingestion, idempotency, payment holds, atomic bulk rollback, stock constraints, immutable ledger, packed snapshots, manager approval, outbox configuration failures, transfer synchronization, returns, centre logistics, vendor receipts, three export formats, dispatch-date cost reporting, session revocation, refresh rotation, Excel/DOCX/structured PDF import, private workbooks, profile permissions, private conversations, task ownership, bounded bulk selection, concurrent warehouse packing, reviewed text sources and employee-scoped notification inboxes.
- Capacity probe: 50,004 students, maximum of three dashboard requests 158 ms, atomic 500-shipment packing 1,895 ms. See performance review for scope and limits.
- All nine browser tests pass (44 tests in total): login/reload, inventory receipt, report download, CSV preview/commit, mobile warehouse permissions, keyboard dialog dismissal, page width, IMS workbook persistence/filtering/chart totals/export, profile/status updates, internal messages/tasks, 500-shipment selection across pages, five analytical chart modes, column profiles, pivot summaries, saved combined filters, reviewed text worksheets, private insight sharing, persistent navigation/scrollbar preferences, notification controls and missing-page recovery.
- Editorial analytics desktop/mobile screenshots were inspected in one bounded visual review; the finish reviewer returned ship with no material fixes. Expanded notification/source-review states and dark mode were source-reviewed, not visually certified. A subsequent CSS specificity correction makes the botanical hover colour effective. Self-hosted font, palette and motion tokens are recorded in frontend DESIGN.md and its schemaVersion 2 sidecar.
- Impeccable detector reports no findings on the new workspace components and stylesheet. This supplements browser checks; it is not an accessibility certification.
- All six migrations apply successfully to the temporary database.
- `npm audit --audit-level=moderate` reports zero vulnerabilities.
- Local app and API readiness return HTTP 200. All five actual local role accounts successfully log in and log out; passwords/tokens are not printed by the verification helper.
- Docker Compose configuration validates. Container images and HTTPS deployment are not exercised locally because the Docker daemon is unavailable.

The runners destroy only their generated temporary databases. Local credentials for Super Admin, Logistics Manager, Dispatch Executive, Warehouse Staff and Viewer/Auditor are in ignored `LOCAL_ACCESS.md`; operational tables remain ready for authoritative setup. Existing business data and passwords are preserved. The document coverage guide describes the employee/Excel additions and external acceptance inputs.

## Required before live use

1. Supply approved centre/course/payment-plan policy, BOMs, prices, actual opening stock and verified courier/postcode coverage.
2. Configure Admissions/Finance integration keys and validate the provider contracts against real upstream events.
3. Configure SMTP and Twilio SMS/WhatsApp credentials and registered templates. Confirm external provider delivery and recovery emails.
4. Provision HTTPS hosting, restricted database credentials, encrypted storage, monitoring and secret management. Execute the container deployment and verify health checks.
5. Restore a backup into staging, test disaster recovery and schedule daily backups with one-year retention.
6. Benchmark realistic BOMs, shipment history and concurrent users; review accessibility and supported browsers beyond the local Chromium checks.
7. Conduct the document's two-week shadow run against existing Excel operations before cutover.

Courier API automation is future scope in the source document. Scanned PDF OCR is excluded. Notification `SENT` records provider acceptance rather than verified handset delivery. Database outbox retries may duplicate delivery if a process stops after provider acceptance. No production deployment, external provider certification, uptime guarantee or legal-compliance certification is claimed.

## October 7 manager-demo additions

One Free Render service now runs Next and Fastify through a supervised launcher, with separate Neon PostgreSQL storage and an included Blueprint. The isolated demo-bootstrap verification passes for five roles, private sample workbooks, reviewer-record persistence, preserved passwords and refusal to initialise over business employees. No external demo URL has been provisioned from local verification. The Free demo guide records exact account setup, SMTP/sleep/quota limits and the difference between code pushes and database data.

Profile photos, message attachments and conversation search use authenticated APIs. Uploaded bytes live in PostgreSQL, so free-host filesystem resets do not erase them. Integration coverage checks participant-only downloads, owner-only removal, replacement cleanup, invalid/oversized files and announcement roles. All seven additive migrations apply to a temporary database. The latest busy-host capacity probe is documented separately.

Final checks pass: 9 domain tests, 27 integration tests and 10 browser workflows (46 total), plus isolated demo-bootstrap verification. Browser workflows run through the combined deployment launcher. TypeScript/ESLint and production builds pass; dependency audit reports zero vulnerabilities. New desktop/mobile profile and chat captures were taken. A staged-content check found no local environment values, local login passwords or recognised secret tokens in the publishable source. These checks do not certify an external Render build until account provisioning and remote login verification are complete.
