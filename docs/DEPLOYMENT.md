# Deployment and recovery

## Production prerequisites

Use Node.js 24, PostgreSQL 15+ and HTTPS. Prepare independent secret values, approved sender/template registration, authoritative Admissions/Finance feeds, verified pincode/courier coverage and a backup destination. The deployment operator must provide these external resources. Container execution was not verified locally because the Docker engine was unavailable.

## Container deployment

1. Copy root `.env.example` to `.env` on the deployment host and replace every example. `FRONTEND_URL` must exactly match `https://ELMS_DOMAIN`. Use URL-safe database password characters or percent-encode reserved characters in DATABASE_URL. Supply optional provider and SMTP variables through environment/secrets. Keep .env permissions restricted.
2. Build images with `docker compose build`. Do not publish development ports or database credentials. The Compose stack exposes only Caddy on 80/443.
3. Start storage: `docker compose up -d db`.
4. Run additive migrations: `docker compose run --rm backend npm run db:migrate`.
5. Bootstrap the first employee/templates: `docker compose run --rm backend npm run db:seed`. Remove ADMIN_PASSWORD from runtime environment after bootstrap. Existing administrator credentials are preserved on subsequent seed runs.
6. Start the application: `docker compose up -d`. DNS must point ELMS_DOMAIN to this host; Caddy manages HTTPS certificates.
7. Check container health and `GET /ready` inside the API network. Log in, configure business masters and test the payment-to-return journey with approved shadow-run records.

Use a separate database owner for migrations and a restricted runtime role for application operations. The provided simple local stack uses one database account for ease of bootstrap; before production replace it with a managed PostgreSQL connection or provision a distinct runtime role, grant table SELECT/INSERT/UPDATE as needed, sequence USAGE, audit/ledger/tracking INSERT+SELECT only, no schema/trigger ownership. Restrict provider ingestion keys to secure department services. Secrets must never be injected into NEXT_PUBLIC variables.

## Non-container deployment

Install dependencies, generate Prisma, migrate, seed and build as in README. Set `NODE_ENV=production` and HTTPS FRONTEND_URL. Run `npm start --workspace backend` and `npm start --workspace frontend` under a supervisor. Reverse proxy HTTPS to Next.js port 3000; the frontend proxies API traffic internally. Expose neither PostgreSQL nor API port 4000 publicly. Monitor readiness, process restarts, outbox failures and disk/backup capacity.

## Backups

Schedule `infra/backup.sh` daily using a trusted scheduler or hosting backup service, with PGHOST/PGUSER/PGDATABASE/PGPASSWORD supplied by secrets and BACKUP_DIR on encrypted storage. Keep a minimum one-year retention and an off-site copy. Host monitoring must alert on missed/failed backups. Production deployment must verify encryption at rest and restore access separately from application code.

Restore into a new database, never directly over the active service:

```sh
createdb elms_restore
pg_restore --exit-on-error --no-owner --dbname=elms_restore /secure/backups/elms-TIMESTAMP.dump
```

Check migration history, student/dispatch/stock counts, foreign keys, append-only history and last snapshot timestamps. Point a staging API to the restored database and test login, eligibility and shipment detail. Compare the recovery point with the business-approved recovery target. Only then plan a supervised cutover. Perform a restore drill at least quarterly.

## Release and rollback

CI runs lint, TypeScript builds, unit/integration/browser tests and dependency audit. CI does not automatically deploy because no hosting destination or deployment credential was supplied. Publish only a passing build. Back up before database changes. Additive migrations preserve older fields; rollback application images only when schema compatibility has been confirmed. Restore from backup into a separate database for destructive recovery; retain the incident database for investigation.

Complete the document's two-week parallel Excel shadow run, staff training and management sign-off before operational cutover. Availability and throughput goals require production monitoring and load testing.
