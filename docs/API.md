# API contract

Base path is `/api/v1`. Success returns `{ "success": true, "data": ... }`. Errors return `{ "success": false, "code": "...", "message": "..." }`. Business rule failures use 422, invalid input 400, absent identity 401, denied permission 403, absent record 404, duplicate/conflict 409 and unconfigured service 503.

Employee requests use `Authorization: Bearer <access token>`. Refresh uses an HttpOnly cookie. Browser write requests require the exact configured Origin. Responses containing employee/business data are not cacheable.

## Authentication

`POST /auth/login` accepts email/password and returns user/accessToken while setting the refresh cookie. `POST /auth/refresh` uses the cookie and rotates it; JSON requests must send `{}` rather than an empty JSON body. `POST /auth/logout` revokes the refresh session. `GET /auth/me`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/reset-password` provide account security. Password reset requires a configured SMTP service and a 30-minute single-use token.

## Lists and operations

`GET /students`, `/dispatches`, `/inventory`, `/ledger`, `/kits`, `/items`, `/transfers`, `/returns`, `/orders`, `/requisitions`, `/notifications`, `/audit`, `/employees`, `/centers`, `/courses`, `/prices`, `/couriers`, `/rules`, `/pincodes`, `/templates` apply module permissions. Supported query fields include page, limit, search, status, courseId, centerId, courierPartnerId, from, to and sort. Filters apply where relevant to the resource. Student detail: `GET /students/:id`. Lookups: `GET /lookups`.

- `POST /queue/reconcile`: `{ "cursor": "optional previous nextCursor" }`; returns created count and continuation cursor, scanning 500 students at a time.
- `POST /dispatches/transition`: ids (1–1000), status, optional warehouseId, awbNumber, courierPartnerId, reason, location, expectedDelivery. Packing requires warehouse. Handover requires manager approval and unique AWB. Override/exception requires reason.
- `POST /inventory/adjust`: itemId, centerId, signed nonzero quantity, reason.
- `POST /kits`, `PUT /kits/:id`: name, courseId, milestoneNumber, weightKg, description, items `[{itemId, quantity}]`.
- `POST /transfers`: studentId, toCourseId, toCenterId, reason. `POST /transfers/:id/resolve`: approved, resolution, reason.
- `POST /returns`: dispatchId, reason. `POST /returns/:id/receive`: condition MINOR, REPACKAGE or UNUSABLE; shipment must be RTO_INITIATED.
- `POST /orders`: fromCenterId, toCenterId, boxes, reason, lines. `POST /orders/:id/dispatch`: awbNumber. `POST /orders/:id/receive`: lines `[{itemId,quantity,damaged}]`.
- `GET /forecast?centerId=...`, `POST /requisitions`: centerId, vendor, lines. `POST /requisitions/:id/receive`: receipt lines.
- `POST /master/:resource`, restricted `PUT /master/:resource/:id`: centre/item/courier/routing/postcode/template configuration. Fees have no employee write endpoint.
- `POST /employees`, `PATCH /employees/:id`: Super Admin only; role/activity changes revoke sessions. Self-demotion/deactivation is blocked.
- `GET /settings`, `PUT /settings`: readiness booleans and forecastBufferPercent/piiRetentionYears. Secrets are absent.
- `POST /notifications/:id/retry`: retry failed or unconfigured messages.

## Authoritative providers

Providers send a distinct `x-provider-key` for their department. POST `/integrations/catalog` is Finance-only and accepts eventId, courses `[{id,name,code,fee}]`, prices `[{courseId,centerId,fee}]`, plans `[{id,name}]`. Catalog must precede student ingestion; referenced centres must exist.

POST `/integrations/students` is Admissions-only. POST `/integrations/payments` is Finance-only. Both accept `{ "eventId": "stable unique source event", "rows": [...] }`, maximum 1000 rows. Successful retries of the same event are deduplicated. Student rows require id, name, Indian mobile, full address/city/state/pincode, courseId, centerId, enrollmentDate, status and paymentPlanId. Optional email/batchId/notes are supported. Payment rows require studentId, milestoneNumber, decimal amount, boolean paid and optional paidAt.

When an enrolment changes, stale payment milestones are cleared. Finance must send the new-course milestones after Admissions confirms the change. A transfer conflicting with a pending manager decision is rejected rather than silently applied. External departments receive no employee login.

## Imports and reports

POST `/imports/preview/:kind` accepts one multipart `file`. Kinds: pincodes, items, students, payments. Protected types also require a scoped provider key. It returns preview id, normalized rows, errors, valid/invalid counts and update flags. POST `/imports/:id/commit` requires the same employee and applicable key. All rows must validate; committed previews cannot be reused.

GET `/reports/:report?format=csv|xlsx|pdf` supports dispatch, pending, delivery, transfer, inventory, print, forecast, courier, cost, audit, monthly, yearly and labels. General exports require export permission; shipping labels require dispatch-write permission. Maximum 10,000 records; oversized results require narrower filters. General reports omit student contact information. Labels preserve packed delivery snapshots.

Money is decimal INR; dates are ISO input, UTC timestamps output. Date-only filters use India calendar boundaries.

## Employee workspace additions

All routes below use `/api/v1`, authenticated employee sessions and server-side permissions.

- `GET/PUT /profile`: own profile and manually selected availability. Cannot change role/email.
- `POST /presence`: visible-app heartbeat; not attendance tracking.
- `GET /team`: bounded active employee directory with safe profile fields.
- `GET/POST /messages`: operations/warehouse/announcements channel or participant-only direct conversation. Announcement writes require Manager/Admin.
- `GET/POST /tasks`, `PATCH /tasks/:id`: permitted tasks and assignee/status updates. Managers may assign others; auditors cannot write.
- `GET/POST /workbooks`, `GET/PATCH/DELETE /workbooks/:id`: private owner datasets and saved views. Uploads need import permission and are bounded to 5 MB/1000 data rows.
- `GET /workbooks/:id/export`: audited complete XLSX, owner plus export permission.
- `POST /workbooks/:id/export-view`: audited CSV of validated source row/column indices; does not trust client-provided cell values.
- `GET /workbook-templates/:id`: headers-only XLSX instructions for supported import shapes.
- `GET /dispatches/select`: filtered 1..1000 dispatch IDs across pages; dispatch-write permission.
- `GET/POST /warehouse-packing`: limited queue and forced PACKED transition; inventory-write permission, no contacts/payments or handover.
- `GET /exceptions`: bounded failed/address/hold/overdue/low-stock findings; dispatch-read permission.
- `GET /inbox`: recent eligible channel/direct updates and the employee's unfinished assigned tasks. Excludes other employees' private conversations/tasks. Device-local read state does not modify source messages.
- `POST /workbooks/from-text`: validates reviewed delimiter/key-value/source-line extraction, creates a private analytical workbook and audits creation. Never writes upstream records.
- `POST /workbooks/extract-text`: bounded selectable PDF/DOCX text for review, using the existing isolated parser/signature/archive guards. No OCR or inferred business-field mapping.

Saved workbook views additionally support chart type, aggregation and up to twelve validated filter conditions. Filtered CSV still exports only verified source cells.

Employee file endpoints require authentication:

- `POST/DELETE /profile/photo`: upload/replace or remove the caller's PNG/JPEG photo, at most 512 KB. Previous photo bytes are deleted on replacement.
- `POST /messages/with-file`: multipart fields `body`, `channel`, optional `recipientId`, followed by one `file`. Message and file are committed atomically. Maximum 2 MB; PNG/JPEG/PDF/TXT/CSV/XLSX/DOCX allowed with signature checks. Announcements retain manager/admin restrictions.
- `GET /files/:id`: authenticated photo display or message download. Message access follows the sender/recipient pair or eligible shared channel; guessed IDs return 404. Responses are non-cacheable and document downloads use attachment disposition.
- `DELETE /files/:id`: owners remove their own message attachment bytes; message text remains. Maximum 10 MB of message file storage per employee, serialised during upload.
- `GET /messages` additionally accepts bounded `search`, applied after conversation access checks; returns the latest 100 matching messages with file metadata, never file bytes.
