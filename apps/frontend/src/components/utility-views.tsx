"use client";
import { useEffect, useState, useRef } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  FileDown,
  ShieldCheck,
  Plug,
  Monitor,
  Printer,
} from "lucide-react";
import { request, download, currency, date, type Row } from "../lib/client";
import { useSession } from "./session";
import { Table, Filters, Badge, type Lookups } from "./resource-view";
import { FormDialog, options, type FormSpec } from "./forms";
function saveText(content: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ImportView() {
  const { has } = useSession();
  const [kind, setKind] = useState(
    has("config:write") ? "pincodes" : "students",
  );
  const [providerKey, setProviderKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    id: string;
    rows: { row: number; data: Row; errors: string[]; updating?: boolean }[];
    valid: number;
    invalid: number;
  } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    setPreview(null);
    const form = new FormData();
    form.append("file", file);
    try {
      setPreview(
        await request(`/imports/preview/${kind}`, {
          method: "POST",
          body: form,
          headers: providerKey ? { "x-provider-key": providerKey } : {},
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setError("");
    try {
      const r = await request<{ imported: number }>(
        `/imports/${preview?.id}/commit`,
        {
          method: "POST",
          body: "{}",
          headers: providerKey ? { "x-provider-key": providerKey } : {},
        },
      );
      setMessage(`${r.imported} records imported. Audit trail recorded.`);
      setPreview(null);
      setFile(null);
      setProviderKey("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const headers: Record<string, string> = {
    pincodes: "code,city,state,serviceable",
    items: "sku,name,pages,unitCost,lowStockThreshold",
    students:
      "id,name,mobile,email,address,city,state,pincode,courseId,centerId,enrollmentDate,status,paymentPlanId",
    payments: "studentId,milestoneNumber,amount,paid,paidAt",
  };
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Review before import</h1>
          <p>Bring familiar files into a verified, auditable workflow.</p>
        </div>
        <button
          className="secondary"
          onClick={() =>
            saveText(headers[kind] + "\n", `elms-${kind}-template.csv`)
          }
        >
          <FileDown size={16} />
          Download column template
        </button>
      </div>
      <div className="import-grid">
        <article className="panel padded">
          <h2>Choose data source</h2>
          <label>
            Import type
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPreview(null);
                setError("");
              }}
            >
              {has("config:write") && (
                <>
                  <option value="pincodes">Verified delivery pincodes</option>
                  <option value="items">Material catalogue</option>
                </>
              )}
              <option value="students">Admissions student export</option>
              <option value="payments">Finance milestone export</option>
            </select>
          </label>
          {["students", "payments"].includes(kind) && (
            <>
              <div className="alert info">
                <ShieldCheck size={18} />
                <span>
                  These records belong to{" "}
                  {kind === "students" ? "Admissions" : "Finance"}. A
                  department-scoped provider key is required.
                </span>
              </div>
              <label>
                Authorised provider key
                <input
                  type="password"
                  autoComplete="off"
                  value={providerKey}
                  onChange={(e) => setProviderKey(e.target.value)}
                />
              </label>
            </>
          )}
          <button
            className="upload-zone"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setFile(e.dataTransfer.files[0] ?? null);
              setPreview(null);
            }}
          >
            <UploadCloud size={36} />
            <strong>{file ? file.name : "Drop a file here or browse"}</strong>
            <span>CSV, XLS/XLSX, structured PDF, DOCX</span>
            <small>5 MB maximum · 1000 rows per import</small>
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept=".csv,.xlsx,.xls,.pdf,.docx"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
          <button
            className="primary full"
            onClick={upload}
            disabled={
              !file ||
              busy ||
              (["students", "payments"].includes(kind) && !providerKey)
            }
          >
            {busy ? "Processing…" : "Parse and preview"}
          </button>
        </article>
        <article className="panel padded">
          <FileSpreadsheet size={28} className="accent" />
          <h2>Keep the source of truth intact</h2>
          <p>
            Column aliases are normalised. Mobile numbers and whitespace are
            cleaned. Duplicate and invalid rows remain visible before anything
            is committed.
          </p>
          <p>
            Existing student IDs are flagged as updates. A preview cannot be
            committed twice. Error rows must be corrected in your source file.
          </p>
          <p className="muted">
            Scanned PDFs and free-form documents need a structured export. No
            payment amounts are inferred from prose.
          </p>
        </article>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}
      {preview && (
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Import preview</h2>
              <p>
                {preview.valid} valid · {preview.invalid} invalid
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="secondary small"
                onClick={() =>
                  saveText(
                    "row,error\n" +
                      preview.rows
                        .filter((r) => r.errors.length)
                        .map(
                          (r) =>
                            `${r.row},"${r.errors.join("; ").replaceAll('"', '""')}"`,
                        )
                        .join("\n"),
                    "elms-import-errors.csv",
                  )
                }
              >
                Download errors
              </button>
              <button
                className="primary"
                disabled={preview.invalid > 0 || busy}
                onClick={commit}
              >
                Confirm {preview.valid} records
              </button>
            </div>
          </div>
          <Table
            columns={[
              { label: "Row", path: "row" },
              { label: "Result", path: "outcome" },
              ...Object.keys(preview.rows[0]?.data ?? {})
                .slice(0, 8)
                .map((k) => ({ label: k, path: `data.${k}` })),
              { label: "Issues", path: "issues" },
            ]}
            rows={preview.rows.map((r) => ({
              ...r,
              outcome: r.errors.length
                ? "Invalid"
                : r.updating
                  ? "Update existing"
                  : "Valid",
              issues: r.errors.join("; "),
            }))}
          />
        </article>
      )}
    </section>
  );
}
export function ReportsView({ lookups }: { lookups: Lookups }) {
  const { has } = useSession();
  const [values, setValues] = useState<Record<string, string>>({});
  const [report, setReport] = useState("dispatch");
  const [format, setFormat] = useState("xlsx");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reports = [
    ["dispatch", "Dispatch report"],
    ["pending", "Pending dispatches"],
    ["delivery", "Delivery confirmations"],
    ["transfer", "Transfer summary"],
    ["inventory", "Inventory status"],
    ["print", "Print requisitions"],
    ["forecast", "Print demand"],
    ["courier", "Courier performance"],
    ["cost", "Material cost tracker"],
    ["audit", "Employee audit"],
    ["monthly", "Monthly summary"],
    ["yearly", "Yearly summary"],
    ["labels", "Shipping labels / manifest"],
  ];
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Reports & exports</h1>
          <p>
            Generate current operational records with the filters your team
            needs.
          </p>
        </div>
      </div>
      {!has("reports:export") ? (
        <div className="alert info">
          Your role can review operational records. Report export requires
          Manager or Auditor access.
        </div>
      ) : (
        <article className="panel padded">
          <div className="form-grid">
            <label>
              Report
              <select
                value={report}
                onChange={(e) => setReport(e.target.value)}
              >
                {reports
                  .filter(([r]) => r !== "labels" || has("dispatch:write"))
                  .map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Format
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="xlsx">Excel workbook</option>
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
            </label>
            <label>
              Courier
              <select
                value={values.courierPartnerId ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, courierPartnerId: e.target.value }))
                }
              >
                <option value="">All courier partners</option>
                {options(lookups.couriers).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Filters
            values={values}
            lookups={lookups}
            onChange={(k, v) =>
              setValues(k === "*" ? {} : { ...values, [k]: v })
            }
          />
          <p className="muted">
            Exports are capped at 10,000 records. Narrow your date range for
            larger volumes. Shipping labels include the delivery address;
            general reports omit contact details.
          </p>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await download(
                  `/reports/${report}?${new URLSearchParams({ ...values, format })}`,
                  `elms-${report}.${format}`,
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <FileDown size={17} />
            {busy ? "Generating…" : "Generate report"}
          </button>
        </article>
      )}
    </section>
  );
}
export function ForecastView({ lookups }: { lookups: Lookups }) {
  const { has } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [centerId, setCenterId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [form, setForm] = useState<FormSpec | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    request<Row[]>(
      `/forecast?${new URLSearchParams(centerId ? { centerId } : {})}`,
    )
      .then((r) => {
        if (live) setRows(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [centerId, version]);
  const lines = rows
    .filter((r) => Number(r.quantity) > 0)
    .map((r) => ({ itemId: r.itemId, quantity: r.quantity }));
  const cost = rows.reduce(
    (n, r) => n + Number(r.quantity) * Number(r.cost),
    0,
  );
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Print demand</h1>
          <p>
            Undispatched enrolment demand plus buffer, less usable material
            stock.
          </p>
        </div>
        {has("print:write") && (
          <button
            className="primary"
            disabled={!lines.length}
            onClick={() =>
              setForm({
                title: "Create requisition from demand",
                endpoint: "/requisitions",
                initial: { centerId, lines },
                fields: [
                  { name: "vendor", label: "Printing vendor", required: true },
                  {
                    name: "centerId",
                    label: "Receiving centre",
                    type: "select",
                    required: true,
                    options: options(lookups.centers),
                  },
                  {
                    name: "lines",
                    label: "Order quantities",
                    type: "lines",
                    options: options(lookups.items),
                  },
                ],
              })
            }
          >
            <Printer size={17} />
            Create requisition
          </button>
        )}
      </div>
      <article className="panel">
        <div className="panel-heading">
          <label>
            Stock location
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
            >
              <option value="">All stock locations</option>
              {options(lookups.centers).map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <strong>Estimated print cost {currency(cost)}</strong>
        </div>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {busy ? (
          <div className="loading-block">Calculating demand…</div>
        ) : rows.length ? (
          <Table
            columns={[
              { label: "Material", path: "name" },
              { label: "Outstanding demand", path: "required" },
              { label: "Current stock", path: "stock" },
              { label: "Suggested order", path: "quantity" },
              { label: "Unit cost", path: "cost", type: "money" },
            ]}
            rows={rows}
          />
        ) : (
          <div className="empty">
            <p>
              Define course kits and sync enrolments to calculate print demand.
            </p>
          </div>
        )}
      </article>
      {form && (
        <FormDialog
          spec={form}
          onClose={() => setForm(null)}
          onSaved={() => setVersion((v) => v + 1)}
        />
      )}
    </section>
  );
}
export function SettingsView() {
  const { user, has, logout } = useSession();
  const [sessions, setSessions] = useState<Row[]>([]);
  const [settings, setSettings] = useState<{
    integrations: Record<string, boolean>;
    settings: Row[];
  } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<FormSpec | null>(null);
  const [theme, setTheme] = useState("system");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    request<Row[]>("/auth/sessions")
      .then(setSessions)
      .catch((e) => setError(e.message));
    if (has("config:read"))
      request<typeof settings>("/settings")
        .then(setSettings)
        .catch((e) => setError(e.message));
  }, [version, has]);
  const applyTheme = (value: string) => {
    setTheme(value);
    localStorage.setItem("elms-theme", value);
    document.documentElement.dataset.theme =
      value === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : value;
  };
  useEffect(() => {
    const value = localStorage.getItem("elms-theme") ?? "system";
    setTheme(value);
    const resolved =
      value === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : value;
    document.documentElement.dataset.theme = resolved;
  }, []);
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Workspace settings</h1>
          <p>Account security, preferences and operational configuration.</p>
        </div>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}
      <div className="settings-grid">
        <article className="panel padded">
          <ShieldCheck className="accent" size={26} />
          <h2>Account security</h2>
          <p>{user?.email}</p>
          <p className="muted">
            Changing your password revokes every active session.
          </p>
          <button
            className="secondary"
            onClick={() =>
              setForm({
                title: "Change password",
                endpoint: "/auth/change-password",
                fields: [
                  {
                    name: "oldPassword",
                    label: "Current password",
                    type: "password",
                    required: true,
                  },
                  {
                    name: "newPassword",
                    label: "New password",
                    type: "password",
                    required: true,
                    hint: "Minimum 12 characters",
                  },
                ],
                submitLabel: "Change password and sign out",
              })
            }
          >
            Change password
          </button>
          <label>
            Appearance
            <select value={theme} onChange={(e) => applyTheme(e.target.value)}>
              <option value="system">System preference</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </article>
        <article className="panel padded">
          <Monitor className="accent" size={26} />
          <h2>Active device sessions</h2>
          {sessions.map((s) => (
            <div className="session-row" key={String(s.id)}>
              <div>
                <strong>
                  {String(s.userAgent ?? "Employee device").slice(0, 75)}
                </strong>
                <p>Created {date(s.createdAt)}</p>
                <small>Expires {date(s.expiresAt)}</small>
              </div>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await request(`/auth/sessions/${s.id}`, {
                      method: "DELETE",
                    });
                    setVersion((v) => v + 1);
                    setMessage("Device session revoked.");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Revoke
              </button>
            </div>
          ))}
        </article>
        {settings && (
          <article className="panel padded span-two">
            <Plug className="accent" size={26} />
            <h2>Integration readiness</h2>
            <p className="muted">
              Service credentials are configured on the server. Secrets are
              never shown here.
            </p>
            <div className="integration-grid">
              {Object.entries(settings.integrations).map(([key, ready]) => (
                <div key={key}>
                  <strong>
                    {key === "sms"
                      ? "SMS"
                      : key === "whatsapp"
                        ? "WhatsApp"
                        : key[0].toUpperCase() + key.slice(1)}
                  </strong>
                  <Badge value={ready ? "Configured" : "Setup required"} />
                </div>
              ))}
            </div>
            {has("config:write") && (
              <button
                className="secondary"
                onClick={() =>
                  setForm({
                    title: "Operational policy",
                    endpoint: "/settings",
                    method: "PUT",
                    initial: {
                      forecastBufferPercent:
                        settings.settings.find(
                          (s) => s.key === "forecastBufferPercent",
                        )?.value ?? 5,
                      piiRetentionYears:
                        settings.settings.find(
                          (s) => s.key === "piiRetentionYears",
                        )?.value ?? 3,
                    },
                    fields: [
                      {
                        name: "forecastBufferPercent",
                        label: "Print buffer (%)",
                        type: "number",
                        min: 0,
                        max: 100,
                        required: true,
                      },
                      {
                        name: "piiRetentionYears",
                        label: "Completed-student PII retention (years)",
                        type: "number",
                        min: 1,
                        max: 10,
                        required: true,
                      },
                    ],
                  })
                }
              >
                Edit operational policy
              </button>
            )}
          </article>
        )}
      </div>
      {form && (
        <FormDialog
          spec={form}
          onClose={() => setForm(null)}
          onSaved={() => {
            if (form.endpoint.includes("change-password")) void logout();
            else {
              setVersion((v) => v + 1);
              setMessage("Settings updated.");
            }
          }}
        />
      )}
    </section>
  );
}
