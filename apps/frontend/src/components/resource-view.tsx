"use client";
import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  FileDown,
} from "lucide-react";
import {
  request,
  post,
  read,
  currency,
  date,
  label,
  download,
  type Row,
} from "../lib/client";
import { useSession } from "./session";
import { FormDialog, Modal, options, type FormSpec, type Field } from "./forms";
import { config, steps, initialDefaults } from "./resource-config";

export interface Lookups {
  centers: Row[];
  courses: Row[];
  items: Row[];
  couriers: Row[];
  kits: Row[];
}
interface Result {
  rows: Row[];
  total: number;
  page: number;
  limit: number;
}
export function Badge({ value }: { value: unknown }) {
  return (
    <span className={`badge ${String(value).toLowerCase()}`}>
      {label(value) || "—"}
    </span>
  );
}
export function Table({
  columns,
  rows,
  actions,
  selected,
  onSelect,
}: {
  columns: { label: string; path: string; type?: string }[];
  rows: Row[];
  actions?: (row: Row) => React.ReactNode;
  selected?: string[];
  onSelect?: (ids: string[]) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {onSelect && (
              <th>
                <input
                  type="checkbox"
                  aria-label="Select visible records"
                  checked={
                    rows.length > 0 &&
                    rows.every((r) => selected?.includes(String(r.id)))
                  }
                  onChange={(e) =>
                    onSelect(
                      e.target.checked ? rows.map((r) => String(r.id)) : [],
                    )
                  }
                />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.path} scope="col">
                {c.label}
              </th>
            ))}
            {actions && <th scope="col">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id ?? r.code ?? r.event ?? i)}>
              {onSelect && (
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select record ${r.id}`}
                    checked={selected?.includes(String(r.id)) ?? false}
                    onChange={(e) =>
                      onSelect(
                        e.target.checked
                          ? [...(selected ?? []), String(r.id)]
                          : (selected ?? []).filter((id) => id !== r.id),
                      )
                    }
                  />
                </td>
              )}
              {columns.map((c) => {
                const v = read(r, c.path);
                return (
                  <td key={c.path}>
                    {c.type === "status" ? (
                      <Badge value={v} />
                    ) : c.type === "money" ? (
                      currency(v)
                    ) : c.type === "date" ? (
                      date(v)
                    ) : c.type === "bool" ? (
                      <Badge value={v ? "Yes" : "No"} />
                    ) : (
                      <span title={String(v ?? "")}>{String(v ?? "—")}</span>
                    )}
                  </td>
                );
              })}
              {actions && <td className="row-actions">{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Filters({
  values,
  onChange,
  lookups,
  statuses,
  search = true,
  dates = true,
  courier = false,
  student = false,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  lookups: Lookups;
  statuses?: string[];
  search?: boolean;
  dates?: boolean;
  courier?: boolean;
  student?: boolean;
}) {
  return (
    <div className="filters">
      {student && (
        <>
          <select
            aria-label="Filter payment status"
            value={values.paymentStatus ?? ""}
            onChange={(e) => onChange("paymentStatus", e.target.value)}
          >
            <option value="">All payment records</option>
            <option value="CLEARED">All recorded milestones paid</option>
            <option value="PARTIAL">Partially paid milestones</option>
            <option value="PENDING">No cleared milestones</option>
          </select>
          <select
            aria-label="Filter student shipment status"
            value={values.dispatchStatus ?? ""}
            onChange={(e) => onChange("dispatchStatus", e.target.value)}
          >
            <option value="">All shipment stages</option>
            {config.dispatches.statuses?.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </>
      )}
      {courier && lookups.kits.length > 0 && (
        <select
          aria-label="Filter kit"
          value={values.kitId ?? ""}
          onChange={(e) => onChange("kitId", e.target.value)}
        >
          <option value="">All kits</option>
          {options(lookups.kits).map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      )}
      {search && (
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search records"
            value={values.search ?? ""}
            onChange={(e) => onChange("search", e.target.value)}
            placeholder="Search by student, AWB, pincode, city…"
          />
        </label>
      )}
      {statuses && (
        <select
          aria-label="Filter status"
          value={values.status ?? ""}
          onChange={(e) => onChange("status", e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      )}
      {courier && lookups.couriers.length > 0 && (
        <select
          aria-label="Filter courier"
          value={values.courierPartnerId ?? ""}
          onChange={(e) => onChange("courierPartnerId", e.target.value)}
        >
          <option value="">All couriers</option>
          {options(lookups.couriers).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {lookups.courses.length > 0 && (
        <select
          aria-label="Filter course"
          value={values.courseId ?? ""}
          onChange={(e) => onChange("courseId", e.target.value)}
        >
          <option value="">All courses</option>
          {options(lookups.courses).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {lookups.centers.length > 0 && (
        <select
          aria-label="Filter centre"
          value={values.centerId ?? ""}
          onChange={(e) => onChange("centerId", e.target.value)}
        >
          <option value="">All centres</option>
          {options(lookups.centers).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {dates && (
        <>
          <label className="date-filter">
            From
            <input
              aria-label="From date"
              type="date"
              value={values.from ?? ""}
              onChange={(e) => onChange("from", e.target.value)}
            />
          </label>
          <label className="date-filter">
            To
            <input
              aria-label="To date"
              type="date"
              value={values.to ?? ""}
              onChange={(e) => onChange("to", e.target.value)}
            />
          </label>
        </>
      )}
      <button className="text-button" onClick={() => onChange("*", "")}>
        Clear filters
      </button>
    </div>
  );
}
export function ResourceView({
  resource,
  lookups,
}: {
  resource: string;
  lookups: Lookups;
}) {
  const def = config[resource];
  const { has } = useSession();
  const [values, setValues] = useState<Record<string, string>>(() =>
    typeof window === "undefined"
      ? {}
      : Object.fromEntries(new URLSearchParams(window.location.search)),
  );
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result>({
    rows: [],
    total: 0,
    page: 1,
    limit: 25,
  });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [form, setForm] = useState<FormSpec | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [format, setFormat] = useState("xlsx");
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      setError("");
      const query = new URLSearchParams({
        ...Object.fromEntries(Object.entries(values).filter(([, v]) => v)),
        page: String(page),
      });
      request<Result>(`/${resource}?${query}`, { signal: controller.signal })
        .then(setResult)
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [resource, page, values, version]);
  const refresh = () => {
    setVersion((v) => v + 1);
    setSelected([]);
    setNotice("Changes saved. Records refreshed.");
  };
  const filter = (k: string, v: string) => {
    const next = k === "*" ? {} : { ...values, [k]: v };
    setValues(next);
    setPage(1);
    setSelected([]);
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(next).filter(([, v]) => v)),
    );
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${qs.size ? "?" + qs : ""}`,
    );
  };
  const enrich = (fields: Field[]) =>
    fields.map((f) => ({
      ...f,
      options:
        (f.options?.length ? f.options : undefined) ??
        (f.type === "lines"
          ? options(lookups.items)
          : f.name.toLowerCase().includes("course")
            ? options(lookups.courses)
            : f.name.toLowerCase().includes("center") ||
                f.name === "warehouseId"
              ? options(lookups.centers)
              : f.name === "itemId"
                ? options(lookups.items)
                : f.name === "courierPartnerId"
                  ? options(lookups.couriers)
                  : []),
    }));
  const create = () => {
    if (!def.create) return;
    const c = def.create;
    setForm({
      title: c.title,
      endpoint: c.endpoint,
      fields: enrich(c.fields),
      initial: initialDefaults(c.fields),
    });
  };
  const transition = (row?: Row) => {
    const ids = row ? [String(row.id)] : selected;
    const allowed = row
      ? (steps[String(row.status)] ?? [])
      : ["PACKED", "HOLD", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
    setForm({
      title: `Update ${ids.length} shipment${ids.length === 1 ? "" : "s"}`,
      description:
        "Payment, address, stock and transfer checks run again before packing or handover.",
      endpoint: "/dispatches/transition",
      initial: { ids, status: allowed[0] },
      fields: enrich([
        {
          name: "status",
          label: "Next stage",
          type: "select",
          required: true,
          options: allowed
            .filter((s) => s !== "HANDED_TO_COURIER" || has("dispatch:approve"))
            .map((v) => ({ value: v, label: label(v) })),
        },
        { name: "warehouseId", label: "Packing warehouse", type: "select" },
        {
          name: "awbNumber",
          label: "Unique tracking number (single shipment)",
        },
        { name: "courierPartnerId", label: "Courier override", type: "select" },
        {
          name: "reason",
          label: "Exception or override reason",
          type: "textarea",
        },
        { name: "location", label: "Current location" },
        {
          name: "expectedDispatch",
          label: "Expected dispatch",
          type: "datetime-local",
        },
        {
          name: "expectedDelivery",
          label: "Expected delivery",
          type: "datetime-local",
        },
        {
          name: "deliveryMode",
          label: "Delivery mode",
          type: "select",
          options: [
            { value: "COURIER", label: "Courier" },
            { value: "SPEED_POST", label: "Speed Post" },
            { value: "IN_PERSON", label: "Hand delivery" },
            { value: "CENTER_TO_CENTER", label: "Centre to centre" },
          ],
        },
      ]),
      submitLabel: "Update shipment",
    });
  };
  const receipt = (row: Row, kind: "orders" | "requisitions") => {
    const lines = (row.lines as Row[])
      .map((l) => ({
        itemId: l.itemId,
        quantity:
          kind === "orders"
            ? Number(l.quantity)
            : Math.max(0, Number(l.quantity) - Number(l.receivedQuantity)),
        damaged: 0,
      }))
      .filter((l) => l.quantity > 0);
    setForm({
      title: "Confirm goods received",
      description: "Enter usable and damaged units. Shortages remain visible.",
      endpoint: `/${kind}/${row.id}/receive`,
      initial: { lines },
      fields: [
        {
          name: "lines",
          label: "Received materials",
          type: "lines",
          options: options(lookups.items),
          receipt: true,
        },
      ],
      submitLabel: "Confirm inward",
    });
  };
  const edit = (r: Row) => {
    if (!def.create) return;
    setForm({
      title: `Edit ${def.title.toLowerCase()}`,
      endpoint:
        resource === "kits"
          ? `/kits/${r.id}`
          : resource === "employees"
            ? `/employees/${r.id}`
            : resource === "pincodes" || resource === "templates"
              ? def.create.endpoint
              : `/master/${resource}/${r.id}`,
      method:
        resource === "employees"
          ? "PATCH"
          : resource === "pincodes" || resource === "templates"
            ? "POST"
            : "PUT",
      initial: r,
      fields: enrich(
        resource === "employees"
          ? [
              { name: "fullName", label: "Name", required: true },
              def.create.fields.find((f) => f.name === "role")!,
              { name: "isActive", label: "Active employee", type: "checkbox" },
            ]
          : def.create.fields,
      ),
    });
  };
  async function inspect(row: Row) {
    try {
      setDetail(
        resource === "students"
          ? await request<Row>(`/students/${row.id}`)
          : row,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function reconcile() {
    setError("");
    setBusy(true);
    try {
      let cursor: string | null = null;
      let created = 0;
      do {
        const r: { created: number; nextCursor: string | null } = await post(
          "/queue/reconcile",
          cursor ? { cursor } : {},
        );
        created += r.created;
        cursor = r.nextCursor;
      } while (cursor);
      setNotice(`${created} eligible shipments added.`);
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const actions = (r: Row) => (
    <>
      {resource === "students" && (
        <button className="text-button" onClick={() => inspect(r)}>
          View history
        </button>
      )}
      {resource === "dispatches" && (
        <>
          <button className="text-button" onClick={() => inspect(r)}>
            History
          </button>
          {has("dispatch:write") &&
            (steps[String(r.status)]?.length ?? 0) > 0 && (
              <button className="text-button" onClick={() => transition(r)}>
                Update stage
              </button>
            )}
        </>
      )}
      {resource === "transfers" &&
        r.status === "PENDING" &&
        has("transfers:approve") && (
          <button
            className="text-button"
            onClick={() =>
              setForm({
                title: "Resolve transfer",
                description:
                  "Approval keeps dispatch blocked until Admissions confirms the new enrolment and Finance resynchronises milestones.",
                endpoint: `/transfers/${r.id}/resolve`,
                initial: { approved: true, resolution: "DEDUCT_MATERIAL_COST" },
                fields: [
                  {
                    name: "approved",
                    label: "Approve transfer (uncheck to reject)",
                    type: "checkbox",
                  },
                  {
                    name: "resolution",
                    label: "Resolution",
                    type: "select",
                    required: true,
                    options: [
                      "CREDIT_ADJUSTMENT",
                      "FLAG_FINANCE",
                      "REQUEST_RETURN",
                      "DEDUCT_MATERIAL_COST",
                    ].map((v) => ({ value: v, label: label(v) })),
                  },
                  {
                    name: "reason",
                    label: "Decision reason",
                    type: "textarea",
                    required: true,
                  },
                ],
              })
            }
          >
            Review decision
          </button>
        )}
      {resource === "returns" &&
        r.status === "REQUESTED" &&
        has("dispatch:write") && (
          <button
            className="text-button"
            onClick={() =>
              setForm({
                title: "Receive returned parcel",
                endpoint: `/returns/${r.id}/receive`,
                description:
                  "Shipment must be in RTO stage. Unusable materials enter damaged stock.",
                fields: [
                  {
                    name: "condition",
                    label: "Condition",
                    type: "select",
                    required: true,
                    options: ["MINOR", "REPACKAGE", "UNUSABLE"].map((v) => ({
                      value: v,
                      label: label(v),
                    })),
                  },
                ],
              })
            }
          >
            Receive
          </button>
        )}
      {resource === "orders" && has("b2b:write") && (
        <>
          {r.status === "REQUESTED" && (
            <button
              className="text-button"
              onClick={() =>
                setForm({
                  title: "Dispatch centre order",
                  endpoint: `/orders/${r.id}/dispatch`,
                  fields: [
                    {
                      name: "awbNumber",
                      label: "Tracking number",
                      required: true,
                    },
                  ],
                })
              }
            >
              Dispatch
            </button>
          )}
          {r.status === "IN_TRANSIT" && (
            <button
              className="text-button"
              onClick={() => receipt(r, "orders")}
            >
              Confirm inward
            </button>
          )}
        </>
      )}
      {resource === "requisitions" &&
        r.status !== "RECEIVED" &&
        has("print:write") && (
          <button
            className="text-button"
            onClick={() => receipt(r, "requisitions")}
          >
            Receive goods
          </button>
        )}
      {resource === "notifications" &&
        ["FAILED", "WAITING_CONFIGURATION"].includes(String(r.status)) &&
        has("notifications:templates:write") && (
          <button
            className="text-button"
            onClick={async () => {
              try {
                await post(`/notifications/${r.id}/retry`, {});
                refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Retry
          </button>
        )}
      {[
        "kits",
        "items",
        "centers",
        "couriers",
        "rules",
        "employees",
        "pincodes",
        "templates",
      ].includes(resource) &&
        def.create &&
        has(def.create.permission) && (
          <button className="text-button" onClick={() => edit(r)}>
            Edit
          </button>
        )}
      {["kits", "orders", "requisitions", "transfers"].includes(resource) && (
        <button className="text-button" onClick={() => inspect(r)}>
          Details
        </button>
      )}
    </>
  );
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>{def.title}</h1>
          <p>{def.description}</p>
        </div>
        <div className="heading-actions">
          <button
            className="icon-button"
            aria-label="Refresh records"
            onClick={() => setVersion((v) => v + 1)}
          >
            <RefreshCw size={18} />
          </button>
          {def.create && has(def.create.permission) && (
            <button className="primary" onClick={create}>
              <Plus size={17} />
              {def.create.title}
            </button>
          )}
        </div>
      </div>
      {notice && (
        <div className="alert success" role="status">
          {notice}
          <button className="text-button" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="alert error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => setVersion((v) => v + 1)}
          >
            Retry
          </button>
        </div>
      )}
      <div className="panel">
        <Filters
          values={values}
          onChange={filter}
          lookups={{
            ...lookups,
            courses: ["students", "dispatches", "prices"].includes(resource)
              ? lookups.courses
              : [],
            centers: [
              "students",
              "dispatches",
              "inventory",
              "ledger",
              "transfers",
              "returns",
              "orders",
              "requisitions",
              "notifications",
              "prices",
            ].includes(resource)
              ? lookups.centers
              : [],
          }}
          dates={[
            "students",
            "dispatches",
            "inventory",
            "ledger",
            "transfers",
            "returns",
            "orders",
            "requisitions",
            "notifications",
            "audit",
          ].includes(resource)}
          statuses={def.statuses}
          courier={resource === "dispatches"}
          student={resource === "students"}
        />
        <div className="table-toolbar">
          <span>
            {result.total.toLocaleString("en-IN")} records
            {selected.length ? ` · ${selected.length} selected` : ""}
          </span>
          <div>
            <details className="column-picker">
              <summary>Columns</summary>
              <div>
                {def.columns.map((c) => (
                  <label key={c.path}>
                    <input
                      type="checkbox"
                      checked={!hiddenColumns.includes(c.path)}
                      onChange={(e) =>
                        setHiddenColumns(
                          e.target.checked
                            ? hiddenColumns.filter((p) => p !== c.path)
                            : hiddenColumns.length < def.columns.length - 1
                              ? [...hiddenColumns, c.path]
                              : hiddenColumns,
                        )
                      }
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </details>
            {[
              "students",
              "dispatches",
              "inventory",
              "ledger",
              "transfers",
              "returns",
              "orders",
              "requisitions",
              "notifications",
              "audit",
              "employees",
            ].includes(resource) && (
              <select
                aria-label="Sort records"
                value={values.sort ?? "desc"}
                onChange={(e) => filter("sort", e.target.value)}
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            )}
            {resource === "dispatches" && has("dispatch:write") && (
              <>
                <button
                  className="secondary small"
                  onClick={async () => {
                    try {
                      await download(
                        `/reports/labels?${new URLSearchParams({ ...values, format: "pdf" })}`,
                        "elms-shipping-labels.pdf",
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Print labels
                </button>
                <button className="secondary small" onClick={reconcile}>
                  <RefreshCw size={14} />
                  Reconcile queue
                </button>
                <select
                  aria-label="Select filtered shipments"
                  value=""
                  onChange={async (e) => {
                    const count = e.target.value;
                    if (!count) return;
                    try {
                      const r = await request<{ ids: string[]; count: number }>(
                        `/dispatches/select?${new URLSearchParams({ ...values, count })}`,
                      );
                      setSelected(r.ids);
                      setNotice(
                        `${r.count} filtered shipments selected across pages. All bulk changes remain atomic.`,
                      );
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  <option value="">Select across pages</option>
                  <option value="100">First 100</option>
                  <option value="500">First 500</option>
                  <option value="1000">First 1000</option>
                </select>
                {selected.length > 0 && (
                  <button
                    className="primary small"
                    onClick={() => transition()}
                  >
                    <PackageCheck size={14} />
                    Update selected
                  </button>
                )}
              </>
            )}
            {has("reports:export") && (
              <>
                <select
                  aria-label="Export format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="xlsx">Excel</option>
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                </select>
                <button
                  className="secondary small"
                  onClick={async () => {
                    try {
                      await download(
                        `/reports/${def.report ?? resource}?${new URLSearchParams({ ...values, format })}`,
                        `elms-${def.report ?? resource}.${format}`,
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <FileDown size={14} />
                  Export
                </button>
              </>
            )}
          </div>
        </div>
        {busy ? (
          <div className="loading-block" role="status">
            Loading records…
          </div>
        ) : result.rows.length ? (
          <Table
            columns={def.columns.filter((c) => !hiddenColumns.includes(c.path))}
            rows={result.rows}
            actions={actions}
            selected={selected}
            onSelect={
              resource === "dispatches" && has("dispatch:write")
                ? setSelected
                : undefined
            }
          />
        ) : (
          <div className="empty">
            <PackageCheck size={36} />
            <h2>No records here yet</h2>
            <p>
              {resource === "students"
                ? "Connect Admissions to receive enrolments. Payment data comes from Finance."
                : resource === "dispatches"
                  ? "Configure kits, verified pincodes and courier rules. Cleared milestones add eligible shipments."
                  : "Add records or clear filters to get started."}
            </p>
          </div>
        )}
        <div className="pagination">
          <span>
            Page {page} of {Math.max(1, Math.ceil(result.total / 25))}
          </span>
          <div>
            <button
              className="secondary small"
              disabled={page <= 1 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              className="secondary small"
              disabled={page * 25 >= result.total || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
      {form && (
        <FormDialog
          key={form.endpoint}
          spec={{ ...form, fields: enrich(form.fields) }}
          onClose={() => setForm(null)}
          onSaved={refresh}
        />
      )}
      {detail && (
        <Details
          resource={resource}
          row={detail}
          lookups={lookups}
          onClose={() => setDetail(null)}
        />
      )}
    </section>
  );
}
function Details({
  resource,
  row,
  lookups,
  onClose,
}: {
  resource: string;
  row: Row;
  lookups: Lookups;
  onClose: () => void;
}) {
  const lines = (row.lines ?? row.items) as Row[] | undefined;
  return (
    <Modal
      title={
        resource === "students"
          ? String(row.name)
          : `${config[resource].title} detail`
      }
      onClose={onClose}
    >
      <div className="modal-body">
        <dl className="detail-grid">
          {config[resource].columns.map((c) => (
            <div key={c.path}>
              <dt>{c.label}</dt>
              <dd>
                {c.type === "money"
                  ? currency(read(row, c.path))
                  : c.type === "date"
                    ? date(read(row, c.path))
                    : String(read(row, c.path) ?? "—")}
              </dd>
            </div>
          ))}
        </dl>
        {resource === "students" && (
          <>
            <h3>Delivery address</h3>
            <p>
              {[row.address, row.city, row.state, row.pincode]
                .map(String)
                .join(", ")}
            </p>
            <h3>Payment milestones</h3>
            <div className="financial-summary">
              {[
                ["Course fee", "totalFee"],
                ["Amount paid", "paid"],
                ["Pending amount", "pending"],
                ["Excess for Finance review", "excess"],
              ].map(([title, key]) => (
                <div key={key}>
                  <span>{title}</span>
                  <strong>
                    {currency(read(row, `financialSummary.${key}`))}
                  </strong>
                </div>
              ))}
            </div>
            <p className="small-note">
              {String(read(row, "financialSummary.priceSource") ?? "")} ·
              Read-only Finance data
            </p>
            <Table
              columns={[
                { label: "Milestone", path: "milestoneNumber" },
                { label: "Amount", path: "amount", type: "money" },
                { label: "Cleared", path: "paid", type: "bool" },
              ]}
              rows={(row.milestoneStatus as Row[]) ?? []}
            />
            <h3>Shipments</h3>
            <Table
              columns={[
                { label: "Kit", path: "name" },
                { label: "Milestone", path: "milestone" },
                {
                  label: "Eligibility / stage",
                  path: "status",
                  type: "status",
                },
                { label: "Blocking reason", path: "reason" },
              ]}
              rows={(row.kitEligibility as Row[]) ?? []}
            />
            {(row.addressValidation as string[] | undefined)?.length ? (
              <div className="alert error">
                {(row.addressValidation as string[]).join("; ")}
              </div>
            ) : null}
            {((row.dispatches as Row[]) ?? []).map((d) => (
              <div className="history-group" key={String(d.id)}>
                <h4>
                  {String(read(d, "kit.name"))} <Badge value={d.status} />
                </h4>
                <p className="muted">
                  Dispatch ID: {String(d.id)} · AWB:{" "}
                  {String(d.awbNumber ?? "Pending")}
                </p>
                <Timeline rows={(d.trackingHistory as Row[]) ?? []} />
              </div>
            ))}
            <h3>Transfers</h3>
            <Table
              columns={config.transfers.columns.filter(
                (c) => c.path !== "student.name",
              )}
              rows={(row.transfers as Row[]) ?? []}
            />
            <h3>Notification history</h3>
            <Table
              columns={[
                { label: "Event", path: "type" },
                { label: "Message", path: "content" },
                { label: "Status", path: "status", type: "status" },
                { label: "Created", path: "timestamp", type: "date" },
              ]}
              rows={(row.notifications as Row[]) ?? []}
            />
          </>
        )}
        {resource === "dispatches" && (
          <>
            <p>Dispatch ID: {String(row.id)}</p>
            <Timeline rows={(row.trackingHistory as Row[]) ?? []} />
          </>
        )}
        {lines && (
          <>
            <h3>Material lines</h3>
            <Table
              columns={[
                { label: "Material", path: "materialName" },
                { label: "Quantity", path: "quantity" },
                { label: "Received", path: "receivedQuantity" },
                { label: "Damaged", path: "damagedQuantity" },
              ]}
              rows={lines.map((l) => ({
                ...l,
                materialName:
                  read(l, "item.name") ??
                  lookups.items.find((i) => i.id === l.itemId)?.name ??
                  l.itemId,
              }))}
            />
          </>
        )}
        {resource === "transfers" && (
          <>
            <p>
              Target course:{" "}
              {String(
                lookups.courses.find((c) => c.id === row.toCourseId)?.name ??
                  row.toCourseId,
              )}
            </p>
            <p>
              Target centre:{" "}
              {String(
                lookups.centers.find((c) => c.id === row.toCenterId)?.name ??
                  row.toCenterId,
              )}
            </p>
            <p>Resolution: {label(row.resolution)}</p>
            <p>{String(row.reason ?? "")}</p>
          </>
        )}
      </div>
    </Modal>
  );
}
function Timeline({ rows }: { rows: Row[] }) {
  return rows.length ? (
    <ol className="timeline">
      {rows.map((e, i) => (
        <li key={String(e.id ?? i)}>
          <Badge value={e.status} />
          <time>{date(e.timestamp)}</time>
          <p>{String(e.reason ?? e.location ?? "")}</p>
        </li>
      ))}
    </ol>
  ) : (
    <p className="muted">No tracking events yet.</p>
  );
}
