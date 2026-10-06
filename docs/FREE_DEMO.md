# Free manager demo

Use Render Free for one combined Next.js/Fastify service and Neon Free for PostgreSQL. Render supplies an HTTPS `onrender.com` URL. No purchased domain is needed. Select Free plans; do not enable paid upgrades. This is a fictional-data demo, not production.

## How the database works

The browser calls this application's authenticated API. Fastify uses Prisma and DATABASE_URL to connect to PostgreSQL. Neon provides that connection URL with a database username/password. Store it only in Render's environment settings. The browser never receives it. GitHub stores source code, not database records or uploaded files. Pushing code does not transfer local business data or local passwords.

## Exact setup

1. At https://console.neon.tech create a new **Free** project named `ims-manager-demo`, using PostgreSQL 18 where available. Use a separate empty database.
2. Click **Connect**, choose the database, disable **connection pooling**, and copy the direct PostgreSQL connection URL with `sslmode=require`. Direct connections let the initial migrations and this small demo use one URL. Never commit the URL. Configure separate pooling/migration connections later if traffic grows.
3. At https://dashboard.render.com sign in with GitHub. Choose **New → Blueprint**, connect `FutureAlok1445/Logistic-Module`, select `main` and root `render.yaml`.
4. Confirm **one Free web service**, with no paid database or disk. Supply the two prompted secrets: `DATABASE_URL` from Neon and a unique `DEMO_PASSWORD` of at least 12 characters. Share the password privately with reviewers.
5. Apply the Blueprint. Build produces shared types, Fastify and Next. Startup applies migrations, creates demo accounts/private fictional workbooks, then starts both processes. FRONTEND_URL comes from RENDER_EXTERNAL_URL, so the assigned HTTPS address works automatically.
6. Open Render's generated URL. Log in with any account below, using your configured DEMO_PASSWORD.

| Role | Email |
| --- | --- |
| Super Admin | admin@demo.example |
| Logistics Manager | manager@demo.example |
| Dispatch Executive | dispatch@demo.example |
| Warehouse Staff | warehouse@demo.example |
| Viewer/Auditor | viewer@demo.example |

7. Demonstrate **IMS Excel → Sample operations · fictional → Open analysis**, filtering/charts/profiles/pivots, reviewed source text, employee status, messages, attachments and tasks. Each employee owns a private sample workbook. Operational registers start empty: configure fictional business masters and use reviewed imports to test operational workflows. Analytical sample rows do not establish stock or Finance clearance.
8. Have reviewers record role, steps, expected behaviour and feedback. Use fictional contacts/addresses/payments during the demo.

Accounts/passwords and reviewer records are preserved across subsequent startups. Changing DEMO_PASSWORD does not overwrite existing passwords; use administrator tools to reset accounts. Initial demo bootstrap refuses a database containing business employees/students. Its marker permits later startups to preserve demo test records.

## Persistence and limits

- Profiles, messages, tasks, workbooks and uploads live in PostgreSQL. They survive web-service restarts while the Neon project remains available.
- Photos: PNG/JPEG, maximum 512 KB. Chat attachments: PNG/JPEG/PDF/TXT/CSV/XLSX/DOCX, one per message, maximum 2 MB. Maximum 10 MB of message attachments per employee; owners can remove old attachments. Downloads require authentication and conversation access. Channel files are available to employees who can read the channel.
- Bounded database file storage suits this small demo. Production needs object storage, larger quota management and malware scanning. Signature/size validation does not certify files as malware-free.
- Render Free sleeps after 15 idle minutes; reopening can take about one minute. Open ahead of the meeting. Background work runs only while the service is awake, so scheduled provider delivery is not guaranteed.
- Free Render has no persistent disk, dashboard shell or one-off jobs. The launcher applies migrations/bootstrap automatically.
- Free Render blocks SMTP ports 25/465/587. Current SMTP recovery/email delivery cannot be demonstrated there. Internal chat/inbox work without provider keys. SMS/WhatsApp require separately configured providers and may cost money; leave them unconfigured.
- Free compute/build/storage quotas apply. Monitor dashboards and stay on Free. Render Postgres expires after 30 days; this configuration uses Neon instead. No unlimited availability or permanent pricing guarantee is claimed.

## Later GitHub updates

From the project directory:

```powershell
git status
git add .
git diff --cached --stat
git commit -m "feat: update logistics demo"
git push origin main
```

Review staged files. Environment files, LOCAL_ACCESS.md, builds and screenshots are excluded. After pushing, use Render **Manual Deploy → Deploy latest commit**, or verify its automatic deployment setting. Source pushes never upload local database records.

## References and deployment status

- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://neon.com/blog/neon-free-plan-1-gb-per-project

Local verification can validate the launcher and app. External deployment still requires Render/Neon account setup, a passing remote build and remote login checks. No public demo URL has been deployed merely by adding this configuration.
