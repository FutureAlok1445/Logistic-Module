# ELMS employee application

Next.js App Router and TypeScript provide the employee workspace. `src/components` contains session handling, navigation, resource tables/forms, dashboard and operational utilities. `src/lib/client.ts` provides the typed API client and in-memory access token handling. The browser calls same-origin `/api/v1`; `next.config.ts` proxies to the Fastify API using server-only `API_INTERNAL_URL`.

Run from repository root with `npm run dev --workspace frontend`. See the root README for database/API setup, verification and deployment.
