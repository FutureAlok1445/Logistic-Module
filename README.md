# ELMS - Logistics Management System

## Overview
The ELMS (Logistics Management System) is an enterprise-scale module designed to manage, track, and optimize the end-to-end delivery of educational kits and physical materials to students.

It is built as a highly scalable application, supporting a robust backend architecture, complete with job queues for background processing and a PostgreSQL relational database.

---

## Project Structure & Architecture
We have adopted a **Monorepo Architecture** using **Turborepo**. This structure was chosen because it allows us to split the application into easily maintainable pieces (e.g., separating the backend, frontend apps, and shared UI/configuration packages) while ensuring fast, cached builds and a shared Node.js environment.

### Folders Created
#### 1. `.planning/`
- **Purpose**: Holds the architectural blueprint and master plans (`PLAN.md` or similar execution blueprints).
- **Why**: Maintaining strict blueprints ensures that any developer (or agent) working on the repository has immediate access to the system design, phases, and workflows.

#### 2. `apps/`
- **Purpose**: Contains the actual runnable applications. Right now, it holds the `backend`.
- **`apps/backend/`**: Our Node.js, Express, and TypeScript backend application.
  - **Why this structure**: 
    - **`prisma/`**: Contains `schema.prisma` for ORM mapping, `migrations/` for tracking database history, and `seed.ts` for populating initial configuration data.
    - **`src/`** (upcoming): Will contain our Express application, controllers, middleware, and services.
    - **`package.json`**: Distinct package handling specific to backend dependencies (like Prisma, BullMQ, Express, Zod).

#### 3. `packages/` (Planned)
- **Purpose**: Holds shared code, such as `eslint-config`, `typescript-config`, and shared UI components if a frontend is added.
- **Why**: Reduces code duplication across multiple applications within the turborepo.

#### 4. `infra/`
- **Purpose**: Contains infrastructure-as-code files like `docker-compose.yml`.
- **Why**: Standardizes the required environment (like Redis instances for BullMQ queues) across all developers' machines.

---

## Technical Stack
- **Framework**: Node.js & Express.js (TypeScript)
- **Monorepo Tool**: Turborepo (for scalable build pipelines)
- **Database**: PostgreSQL (Locally hosted)
- **ORM**: Prisma (Version 5.22.0)
- **Job Queues**: BullMQ & Redis (Handles background tasks like dispatch events and notifications safely without blocking API endpoints)
- **Validations**: Zod
- **Auth**: JWT & Bcryptjs

---

## Implementation Phases (Current Status)

### ✅ PHASE 1: Project Scaffold & Monorepo Setup
- Initialized **Turborepo** workspace.
- Setup `apps/backend/` as a Node/Express container.
- Installed required production dependencies (Express, BullMQ, Prisma, Postgres, JSONWebToken, Zod, etc.).
- Setup `typescript` tooling & Turborepo pipelines (`turbo.json`).
- Resolved File Encoding (UTF-8 BOM) issues natively inside the Windows environment to ensure strict compatibility with Prisma.

### ✅ PHASE 2: Database Schema & Migrations
- Configured PostgreSQL connection in `.env`.
- Written the **Complete Prisma Schema** supporting 14 models covering Employees, Students, Milestones, Courses, Centres, Dispatches, and Tracking Events.
- Successfully applied the `init_all_tables` database migration.
- Successfully applied Raw SQL performance optimizations (`pg_trgm` and `gin` indexes to boost search queries and `idx_dispatch_queue` partial indices).
- Addressed database schema validation and encoding corruptions successfully.
- Seeded the database with master values via `prisma/seed.ts` (Centers, Courses, Courier Partners, and Super Admin).

### ✅ PHASE 3: Core Infrastructure (Redis, Logger, Error Handling)
- **Environment Validation (`src/config/env.ts`)**: Structured the `.env` with strict `zod` validation so missing variables throw immediate errors instead of causing silent failures later in production.
- **Prisma Client Singleton (`src/config/database.ts`)**: Prevented exhausting database connections by using a single instance of Prisma during hot-reloads in development.
- **Redis Client & BullMQ (`src/config/redis.ts` & `queue.ts`)**: Integrated `ioredis` with auto-retry mechanisms for consistent caching and connected it to `bullmq` to lay the groundwork for asynchronous tasks (e.g. notifications and dispatches).
- **Structured Logger (`src/config/logger.ts`)**: Adopted `pino` for blazingly fast JSON logging in production and `pino-pretty` for human-readable outputs during development.
- **Custom Error Classes & Global Handler (`src/shared/errors.ts` & `src/middleware/error-handler.ts`)**: Centralized error logic so controllers can throw business exceptions (`AppError`, `NotFoundError`) directly, without needing repetitive try/catch chunks on every route.
- **Audit Log Service (`src/modules/audit/audit.service.ts`)**: Established a non-blocking tracking system to record user actions (vital for logging dispatch transitions and sensitive operations) gracefully.
- **Main App Entry (`src/app.ts`)**: Mounted `helmet` for security headers, `cors` for frontend interactions, standardized the `/health` check route, and hooked the global error handler securely at the application layer base.

---

## Why are all these things necessary?
1. **Turborepo & Monorepo**: Prevents tangled dependencies and standardizes future expansions (like building an Admin Portal).
2. **Prisma ORM**: Provides strict TypeScript typings that prevent SQL injection vulnerabilities and gives developer confidence when writing complex queries.
3. **Pino Logger**: The built-in Node `console.log` is notoriously slow and unsuited for production logs. Pino handles JSON output beautifully without blocking the event loop.
4. **BullMQ / Redis**: Logistics systems require background tasks (changing status for 1000s of dispatches, firing SMS/Emails). Doing this on the main Node thread would crash the app. Queues fix this seamlessly.
5. **Global Error Handling**: Unhandled exceptions traditionally crash Node servers. A centralized mechanism parses logic errors smoothly into formatted JSON, protecting users from viewing internal tracking vectors (`stack traces`).
6. **Performance Indexes**: We added raw SQL partial indexes (`WHERE "paid" = false` and `WHERE "status" IN ('QUEUED', ...)`) so that dashboard lists load instantly even if the database reaches 10 million rows.

---

*This file operates as the living single source of truth for the ELMS implementation phase overview.*