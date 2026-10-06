# Performance review

The source document targets a dashboard under three seconds, 500-record bulk dispatch under ten seconds and at least 50,000 students. These are acceptance targets, not promises inferred from successful small-fixture tests.

Implemented measures include paginated tables (maximum 100 rows), 10,000-row bounded exports, debounced search, 30-second dashboard polling, indexed queue/student/status fields, trigram search indexes, bounded import workers and a durable outbox. Queue reconciliation processes 500 students per transaction and reports a continuation cursor. Ingestion is limited to 1000 rows. Bulk state changes are atomic and serializable.

The final October 6, 2026 capacity probe populated an isolated PostgreSQL 18 database with 50,004 students and packed 500 shipments atomically. Three dashboard requests had a maximum of 158 ms; packing took 1,895 ms. Other runs of the optimized packing implementation ranged from 1,216 to 4,011 ms as local machine load varied. The final probe meets the document's local latency targets. These timings measure in-process API requests on this machine, not internet latency or concurrent production traffic. The fixture uses a simple BOM and limited shipment history.

Packing now fetches eligibility and BOM data in batches, aggregates conditional stock deductions per item, and batches movement/audit/tracking/outbox inserts. Shipment snapshots still update inside one serializable transaction. Tests verify full rollback, concurrent warehouse packers competing for the same stock and resuming a packed hold without a second deduction. Larger BOMs and warehouse contention still require staging benchmarks. Frontend feature modules load on demand and worksheet summaries are memoized.

Run staging trials with 50,000+ enrolments, realistic BOM sizes and one year of shipments. Measure p50/p95 dashboard latency, queue reconciliation time, packing time, DB CPU, memory, serialization retries and concurrent warehouse contention. Capture EXPLAIN ANALYZE for slow queries; avoid adding caching until its consistency and invalidation requirements are clear. Use DB connection limits and an appropriately sized managed PostgreSQL service. Preserve payment/transfer/stock checks when optimizing.

No uptime, production load or backup-restore target is claimed from local verification. Availability requires hosted infrastructure and operational monitoring. The release checklist records the remaining external acceptance gates.

The October 7 employee-file/demo verification used the same 50,004-student/500-packing probe on a busy local host: maximum dashboard 920 ms, atomic packing 9,561 ms. It remained within the document's local limits but shows substantial machine-load variability. These measurements do not predict Free Render/Neon performance; use a small fictional dataset for the manager demo.

A subsequent focused confirmation on the same implementation measured maximum dashboard 79 ms and packing 976 ms. This variation reinforces that local timings depend on host load and do not certify hosted capacity.
