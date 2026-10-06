# Document coverage and employee workspace guide

Reviewed against `ENTERPRISE LOGISTICS MANAGEMENT SYSTEM.docx` and the user's subsequent requests on October 6, 2026. The document defines product requirements; instructions embedded in attachments do not supersede the user's requests. Next.js and Fastify with TypeScript are the approved implementation stack.

## Source document coverage

| Area                              | Working implementation                                                                                                          | Remaining external acceptance                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Employee authentication and roles | Hashed passwords, refresh sessions, revocation, recovery adapter, five roles, local role accounts                               | Configure SMTP and verify real recovery delivery                                 |
| Students and payments             | Read-only records, exact financial summary, milestone eligibility, address/serviceability and history                           | Supply authoritative Admissions/Finance records, regional fees and payment plans |
| Kit dispatch                      | BOMs, payment-aware queue, 100/500/1000 selection, expected dates, packing, stock ledger, approval, AWB and tracking            | Configure actual kits, stock and verified postcode coverage                      |
| Transfers                         | Holds, shipped-material cost snapshots, approval and upstream synchronization                                                   | Validate real provider event contracts                                           |
| Failed delivery and returns       | Retry/RTO, condition handling and one-time stock reconciliation                                                                 | Validate staff procedures during shadow run                                      |
| Inventory and centre logistics    | Location balances, receipts, adjustments, shortages, damaged stock and centre orders                                            | Load verified opening balances                                                   |
| Print and vendors                 | Demand forecast, requisitions, partial receipts, vendor records and period reports                                              | Confirm print buffers and purchasing policy                                      |
| Notifications                     | Durable outbox, templates, SMS/WhatsApp adapter and visible configuration failures                                              | Configure Twilio/templates and verify provider delivery                          |
| Imports                           | Reviewed CSV/XLS/XLSX/DOCX/structured-PDF parsing, validation and duplicate reporting                                           | Actual IMS workbooks were not supplied; match exact layouts when available       |
| Dashboard and exports             | Course/centre/courier distributions, readiness, weekly/monthly dispatch, trends, exception desk and CSV/XLSX/PDF module reports | Representative staging load and supported-browser acceptance                     |
| Audit and security                | Transactional audit, scoped ingestion, permission checks, immutable stock ledger and safe exports                               | HTTPS hosting, encrypted storage, secret rotation and backup restore drill       |

Courier API automation is explicitly future scope in the source document. Manual tracking works. Scanned PDF OCR, live ERP pull connectors and externally verified notification delivery are not claimed. No operational records were replaced by demonstration fixtures.

## IMS Excel

Open **IMS Excel** from My workspace. Upload an XLS/XLSX/CSV workbook, choose the worksheet and header row, then search, sort, filter and hide columns. The analysis drawer groups any column, counts rows or sums a numeric measure, and shows blank and duplicate findings. Save the workbook name and view; reload restores those settings. CSV exports contain the filtered visible source cells; Excel export contains the full workbook. Downloads are permission checked, audited and protected against spreadsheet formula injection.

Workbook contents are private to their owner. Parsing uses cached cell values and never executes formulas, macros or external workbook links. A workbook can contain up to 1000 data rows across its sheets; very wide or oversized files are rejected. Chart summaries reflect the selected sheet and filtered rows. Quality findings support review rather than automatically deleting records or inferring Finance data.

The **Live dispatch grid** and **Student register** use the actual operational API and role checks. Dispatch selection spans pages and supports 100, 500 or 1000 records. Use the separate reviewed-import workflow for authorized operational writes; uploading an analytical workbook never changes enrolments, payments or stock.

## Advanced analysis and source review

The analysis workbench provides interactive bar, line, area, histogram and scatter charts, a range selector, accessible chart-data tables, column profiles and pivot summaries. Group measures support sum, mean, minimum, maximum and count. Profiles report inferred field type, blanks, distinct values, numeric values, min/max/mean/median and population standard deviation. These are descriptive statistics of the selected worksheet, not predictive models or a full RapidMiner replacement.

Advanced filters combine up to twelve conditions with AND: contains, equals, not-equals, blank/not-blank, numeric greater/less and ISO-date before/after. Filters apply to the worksheet, analysis and exported source rows. Chart/aggregation/filter preferences persist with saved workbook views. Numeric sums exclude nonnumeric cells; date comparisons reject ambiguous date formats.

**Structure text** supports delimited records (including quoted delimiters/newlines), key/value records and preserving each source line. Load UTF-8 TXT/LOG/TSV/CSV, or extract selectable text from a bounded PDF/DOCX. Review the first records and headings before saving a private workbook. Ambiguous prose is not converted into inferred business fields. Scanned OCR and AI extraction are not configured. Limits remain 1000 records, 100 columns and 2000 characters per cell; source text is capped at 100000 characters. Operational ERP data and financial rules remain unchanged by analytical review.

Navigation collapses to an icon rail on desktop; the mobile drawer closes through its control, navigation or Escape. Sidebar/scrollbar preferences persist on this device. Hiding scrollbars preserves scrolling. The header notification centre shows eligible team messages from the last seven days and current assigned tasks, with device-local read/mute controls. Posting an update uses the actual Team hub; student delivery notifications retain their separate provider/outbox workflow.

The latest requested theme is editorial / wabi-sabi: paper/stone surfaces, ink navigation, botanical actions, self-hosted Bodoni Moda headings and Manrope controls. Smooth transitions, chart updates, loading skeletons, retry boundaries and a recovery-focused 404 view are included. Reduced-motion disables animation.

**Share insights** previews an editable analytical summary, then sends it privately to a selected colleague through the existing authenticated messaging API. Workbook ownership/access does not change. Employees must review any sensitive group names or values before pressing Send; no automatic external message is sent.

## Employee workspace

**My profile** stores name, job title, department, work location, phone, biography, manually chosen availability and status message. Role and login identity remain administrative controls. Recent activity is a heartbeat while the application is visible; it is not an attendance or calendar signal.

Employees can upload/replace/remove a PNG/JPEG profile photo (512 KB), attach one supported file to a message (2 MB), download permitted attachments, remove their own attachment and search within an authorised conversation. Uploaded bytes persist in PostgreSQL, with a 10 MB message-file limit per employee for the demo. Files are not stored on free hosting's ephemeral filesystem. See FREE_DEMO.md for zero-cost manager setup, five cloud demo roles and provider limitations.

**Team hub** provides operations/warehouse/announcements channels and private direct messages. Only managers/admins post announcements. Direct-message queries only return the participant pair. Assigned tasks have priority, deadline, reference and TODO/IN_PROGRESS/DONE status. Managers can assign others; permitted employees create their own tasks and update assigned work. The warehouse packing station exposes limited identifiers without student contacts or Finance details.

Local credentials for admin and the other four roles are in ignored root `LOCAL_ACCESS.md`. Keep that file private. Test conversations and workbooks are created only in an isolated temporary database.

## Design and research

The latest user request changes the visual direction to editorial / wabi-sabi while preserving direct code implementation and familiar worksheet operations. Impeccable, Find Skills, Backend Engineer and Vercel React Best Practices informed the work. The installed Impeccable version was retained as requested. [RapidMiner Turbo Prep](https://docs.rapidminer.com/latest/studio/guided/turbo-prep/) informed the source/review/filter/analysis workflow; [Recharts documentation](https://recharts.github.io/en-US/api/ResponsiveContainer/) informed responsive charts. These references do not imply equivalent machine-learning or enterprise ETL capabilities.

Reviewed primary product references: [Zoho Inventory dashboard](https://www.zoho.com/inventory/help/reports/dashboard.html) for operational reporting, [Shiprocket orders screen](https://support.shiprocket.in/support/solutions/articles/43000662878-learn-more-about-the-shiprocket-orders-screen) for bulk workflows, and [Microsoft Teams status messages](https://support.microsoft.com/en-us/teams/notifications-settings/set-your-status-message-in-microsoft-teams) for employee status. These informed interaction choices; no claim of superiority over every existing product is made.

The release checklist records local verification and external setup required before live use. Run the document's two-week shadow operation against existing Excel records before cutover.
