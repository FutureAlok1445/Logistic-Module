# Enterprise Logistics Management System (ELMS)

ELMS is the internal enterprise logistics workspace for IMS Learning Resources. It enforces payment-aware dispatch, reconciles course transfers, and tracks educational material movements across warehouses, courier partners, and regional centres.

Built with **Next.js App Router, Fastify, TypeScript, Prisma, and PostgreSQL**.

- **Security & Integrity**: Browser credentials stay out of `localStorage`. Real PostgreSQL database transactions govern all inventory deductions, shipments, and ledger entries.
- **Zero-Cost Manager Demo**: Deployable on [Render Free + Neon Free](docs/FREE_DEMO.md) using the included `render.yaml` with five pre-configured demo roles, sample fictional workbooks, and persistent file attachments.
- **Modern Editorial Workspace**: Responsive interface with self-hosted typography (Bodoni Moda & Manrope), dark/light mode support, persistent sidebar navigation, and seamless, instant client-side page transitions.

---

## 📋 Implemented Workflows & Features

- **Authentication & Sessions**: Employee authentication, password change, email recovery, role-based access control (RBAC), and immediate device-session revocation.
- **Admissions & Finance Ingestion**: Read-only student and payment visibility, scoped Admissions/Finance ingestion endpoints, and idempotent event handling.
- **Dispatch Operations**: Payment-aware dispatch queue, verified postcode rules, bulk packing with atomic stock deduction, manager handover approval, unique AWB generation, and complete shipment history.
- **Inventory & BOM Management**: Bill of Materials (BOM) definitions, material catalogue, multi-location stock tracking, append-only inward/adjustment ledger, and low-stock indicators.
- **Transfers & Reconciliations**: Course and regional centre transfer requests, exact material-cost reconciliation, approval workflows, and authoritative enrolment synchronization.
- **Returns & Reverse Logistics**: Delivery retry/RTO handling, one-time returns reconciliation, and damaged/unusable stock separation.
- **Centre Bulk Orders**: Outward branch shipments, inward arrival confirmations, and discrepancy tracking.
- **Print Demand & Vendor Requisitions**: Forecasted material demand, vendor requisitions, partial receipts, and purchase order reconciliation.
- **Messaging Outbox**: Durable SMS/WhatsApp notification queue, editable operational templates, live Twilio adapter, and visible provider configuration state.
- **Document & Data Imports**: CSV, XLS/XLSX, structured PDF, and DOCX preview/import with column normalization, duplicate detection, and validation errors.
- **Reporting & Auditing**: Live operational dashboard, search/filter/pagination, CSV/XLSX/PDF reporting, tamper-resistant shipping manifests, and system audit log.
- **IMS Excel Studio**: Private saved workbooks, multi-sheet tabs, customizable headers, sortable/filterable columns, charts, duplicate analysis, saved views, and audited exports.
- **Employee Hub & Communications**: Employee profiles, manual status/availability, internal channels, private direct messaging with secure file attachments, task management, and exception desk.
- **Warehouse Packing Station**: Streamlined packing interface with limited student PII, barcode-ready workflows, atomic stock deduction, and 100/500/1000 bulk selection across dispatch batches.
- **Analytics Workbench**: Five interactive chart visualizations, pivot summaries, field statistics, multi-condition filters, and private insight sharing.

---

## 🏗️ Architecture & Project Structure

The project is structured as a Turborepo monorepo:

```
Logistic-Module/
├── apps/
│   ├── backend/             # Fastify REST API, Prisma ORM, Auth, Business Logic
│   │   ├── prisma/          # Schema, migrations, and seed scripts
│   │   ├── src/             # Routes, services, middleware, and plugins
│   │   └── test/            # Integration and unit tests
│   └── frontend/            # Next.js App Router (React 19)
│       ├── src/
│       │   ├── app/         # App routes, global & editorial styling
│       │   └── components/  # Workspace, dashboard, studio, and resource views
│       └── scripts/         # Standalone build helpers
├── packages/
│   └── shared-types/        # Shared TypeScript contracts and interfaces
├── tests/
│   └── browser/             # Playwright end-to-end and workflow browser tests
├── docs/                    # Architecture, PRD, Security, Performance, and Setup guides
└── scripts/                 # Monorepo and E2E automation scripts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 24+ recommended
- **npm**: Version 10+
- **PostgreSQL**: Version 15 or later (requires `pg_trgm` extension support)

### 1. Installation

Clone the repository and install dependencies:

```powershell
npm ci
```

### 2. Environment Configuration

Copy the example environment files for both apps:

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/frontend/.env.example apps/frontend/.env
```

Ensure `apps/backend/.env` has your valid `DATABASE_URL` and secrets:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/elms?schema=public"
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
FRONTEND_URL="http://localhost:3000"
PORT=4000
```

### 3. Database Migration & Seed

Run database migrations and seed sample lookup and catalog data:

```powershell
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
```

> **Tip (Local First Admin)**: To generate a local administrator account without manual SQL entry, run:
>
> ```powershell
> node apps/backend/scripts/bootstrap-local.cjs
> ```
>
> Generated credentials are saved locally to `LOCAL_ACCESS.md` (which is git-ignored). To generate demo logins for all roles (Manager, Dispatch Executive, Warehouse Staff, Auditor), run `node apps/backend/scripts/create-role-logins.cjs`.

### 4. Running the Development Server

Start both backend (port 4000) and frontend (port 3000) concurrently:

```powershell
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser. Next.js automatically proxies API requests from `/api/v1` to the Fastify backend on port 4000.

---

## 🧪 Testing & Verification

Run the test suite across packages:

```powershell
# Typechecking and linting
npm run lint

# Build all packages
npm run build

# Fastify backend integration tests (runs isolated against a temporary database)
npm run test:integration

# Browser end-to-end tests with Playwright
npx playwright install chromium
npm run test:e2e

# Security audit
npm audit --audit-level=moderate
```

_Note: Integration and E2E runners create and teardown a temporary test database automatically, leaving your primary operational data intact._

---

## ⚙️ Environment Variables Reference

| Variable                | Scope    | Description                                                      |
| ----------------------- | -------- | ---------------------------------------------------------------- |
| `DATABASE_URL`          | Backend  | PostgreSQL connection string with `pg_trgm` capability           |
| `PORT`                  | Backend  | API port (default: `4000`)                                       |
| `NODE_ENV`              | Both     | `development`, `test`, or `production`                           |
| `JWT_ACCESS_SECRET`     | Backend  | Secret used to sign short-lived JWT access tokens                |
| `JWT_REFRESH_SECRET`    | Backend  | Secret used to sign rotating refresh tokens                      |
| `FRONTEND_URL`          | Backend  | Permitted CORS and cookie origin (e.g., `http://localhost:3000`) |
| `API_INTERNAL_URL`      | Frontend | Server-to-server API endpoint for Next.js SSR / proxies          |
| `ADMISSIONS_API_KEY`    | Backend  | Secret key required for scoped Admissions ingest routes          |
| `FINANCE_API_KEY`       | Backend  | Secret key required for scoped Finance payment ingest routes     |
| `SMTP_*`                | Backend  | Optional SMTP configuration for password reset emails            |
| `TWILIO_*`              | Backend  | Optional Twilio credentials for SMS and WhatsApp dispatch alerts |
| `NEXT_PUBLIC_DEMO_MODE` | Frontend | Enables the demo banner when set to `"true"`                     |

---

## 📖 Documentation Index

- [Product Requirements Document (PRD)](docs/PRD.md)
- [System Architecture & Data Ownership](docs/ARCHITECTURE.md)
- [API Specification & Ingestion Contracts](docs/API.md)
- [Deployment & Disaster Recovery](docs/DEPLOYMENT.md)
- [Zero-Cost Demo Deployment Guide](docs/FREE_DEMO.md)
- [Security Review](docs/SECURITY_REVIEW.md)
- [Performance Review & Benchmarks](docs/PERFORMANCE_REVIEW.md)
- [Design System & Editorial Workspace](docs/DESIGN_SYSTEM.md)
- [Document Coverage & Employee Workspace Guide](docs/DOCUMENT_COVERAGE.md)

---

## 🛠️ Operational Guidelines

1. **Transactional Integrity**: All stock deductions, dispatches, and material transfers must commit within an atomic database transaction. Never adjust stock or dispatches without recording an audit entry.
2. **Ingestion Boundaries**: Only authorized Admissions and Finance services with valid API keys may ingest enrolments or fee payments. Operational users cannot manually invent student enrolments.
3. **Data Privacy**: Student contact PII is protected and omitted from general warehouse and packing station views.
4. **Code Quality**: Code must pass strict TypeScript checks (`tsc --noEmit`), ESLint rules, and Prettier formatting (`npm run format`).
