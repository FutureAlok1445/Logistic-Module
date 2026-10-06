"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { matchesFilters, type DataFilter } from "shared-types";
import { FilterBuilder } from "./analysis-filters";
import type { Aggregate, ChartKind } from "./analytics-workbench";
import { TextWorkbook } from "./text-workbook";
import { ShareInsights } from "./share-insights";
const AnalyticsWorkbench = dynamic(
  () => import("./analytics-workbench").then((m) => m.AnalyticsWorkbench),
  {
    loading: () => (
      <div className="loading-block" role="status">
        Opening analysis workbench…
      </div>
    ),
  },
);
import {
  Upload,
  FileSpreadsheet,
  ChartColumn,
  Download,
  Save,
  Trash2,
  Search,
  ChevronDown,
  ArrowUpDown,
  PanelRight,
  AlertTriangle,
} from "lucide-react";
import { request, download, date } from "../lib/client";
import { useSession } from "./session";
import { ResourceView, type Lookups } from "./resource-view";

type Sheet = { name: string; rows: string[][] };
type View = {
  sheet?: number;
  header?: number;
  group?: string;
  measure?: string;
  hidden?: string[];
  chart?: ChartKind;
  aggregate?: Aggregate;
  filters?: DataFilter[];
};
type Workbook = {
  id: string;
  name: string;
  filename: string;
  rowCount: number;
  createdAt: string;
  sheets: Sheet[];
  view: View;
};
type Summary = Omit<Workbook, "sheets" | "view">;
export const numericValue = (s: string) => {
  const cleaned = s.replace(/[₹,$%\s]/g, "");
  return cleaned && /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
};
export function WorkbookStudio({ lookups }: { lookups: Lookups }) {
  const { has } = useSession();
  const [sharing, setSharing] = useState(false);
  const [explore, setExplore] = useState(false),
    [textReview, setTextReview] = useState(false),
    [filters, setFilters] = useState<DataFilter[]>([]),
    [chart, setChart] = useState<ChartKind>("bar"),
    [aggregate, setAggregate] = useState<Aggregate>("sum");
  const [tab, setTab] = useState("workbook"),
    [list, setList] = useState<Summary[]>([]),
    [book, setBook] = useState<Workbook | null>(null);
  const [sheet, setSheet] = useState(0),
    [header, setHeader] = useState(0),
    [search, setSearch] = useState(""),
    [group, setGroup] = useState(""),
    [measure, setMeasure] = useState(""),
    [hidden, setHidden] = useState<string[]>([]);
  const [sort, setSort] = useState<{ col: number; asc: boolean } | null>(null),
    [filterCol, setFilterCol] = useState(""),
    [filterValue, setFilterValue] = useState(""),
    [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [name, setName] = useState("");
  const refresh = () =>
    request<Summary[]>("/workbooks")
      .then(setList)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void refresh();
  }, []);
  function open(b: Workbook) {
    setBook(b);
    setName(b.name);
    setSheet(b.view.sheet ?? 0);
    setHeader(b.view.header ?? 0);
    setGroup(b.view.group ?? "");
    setMeasure(b.view.measure ?? "");
    setHidden(b.view.hidden ?? []);
    setFilters(b.view.filters ?? []);
    setChart(b.view.chart ?? "bar");
    setAggregate(b.view.aggregate ?? "sum");
    setSearch("");
    setPage(1);
    setSort(null);
    setFilterCol("");
    setFilterValue("");
  }
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    try {
      open(await request<Workbook>("/workbooks", { method: "POST", body }));
      await refresh();
      setNotice(
        "Workbook saved privately. Analysis does not change student, payment or stock records.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const matrix = useMemo(() => book?.sheets[sheet]?.rows ?? [], [book, sheet]);
  const columns = useMemo(() => {
    const seen = new Map<string, number>();
    return (matrix[header] ?? []).map((v, i) => {
      const raw = v || `Column ${i + 1}`,
        count = (seen.get(raw) ?? 0) + 1;
      seen.set(raw, count);
      return count > 1 ? `${raw} (${count})` : raw;
    });
  }, [matrix, header]);
  const base = useMemo(
    () =>
      matrix
        .slice(header + 1)
        .filter(
          (r) =>
            r.some((v) => v.trim()) &&
            !r.every((v, i) => v === matrix[header]?.[i]),
        ),
    [matrix, header],
  );
  const rows = useMemo(() => {
    let r = base
      .map((cells) => ({ cells, index: matrix.indexOf(cells) + 1 }))
      .filter(
        (r) =>
          !search ||
          r.cells.some((v) => v.toLowerCase().includes(search.toLowerCase())),
      );
    if (filterCol && filterValue) {
      const i = columns.indexOf(filterCol);
      r = r.filter((r) => r.cells[i] === filterValue);
    }
    if (filters.length)
      r = r.filter((r) => matchesFilters(r.cells, columns, filters));
    if (sort) {
      const { col, asc } = sort;
      r = [...r].sort((a, b) => {
        const x = a.cells[col] ?? "",
          y = b.cells[col] ?? "",
          nx = numericValue(x),
          ny = numericValue(y);
        return (
          (nx !== null && ny !== null
            ? nx - ny
            : x.localeCompare(y, undefined, { numeric: true })) * (asc ? 1 : -1)
        );
      });
    }
    return r;
  }, [base, matrix, search, sort, filterCol, filterValue, columns, filters]);
  const stats = useMemo(() => {
    const signatures = new Set<string>();
    let duplicates = 0,
      blank = 0;
    for (const r of rows) {
      const key = JSON.stringify(r.cells);
      if (signatures.has(key)) duplicates++;
      signatures.add(key);
      blank += columns.reduce(
        (n, _, i) => n + (!(r.cells[i] ?? "").trim() ? 1 : 0),
        0,
      );
    }
    const groups = new Map<
      string,
      { count: number; sum: number; valid: number }
    >();
    const gi = columns.indexOf(group),
      mi = columns.indexOf(measure);
    for (const r of rows) {
      const key = gi >= 0 ? r.cells[gi] || "(blank)" : "All records",
        g = groups.get(key) ?? { count: 0, sum: 0, valid: 0 };
      g.count++;
      const number = mi >= 0 ? numericValue(r.cells[mi] ?? "") : null;
      if (number !== null) {
        g.sum += number;
        g.valid++;
      }
      groups.set(key, g);
    }
    return {
      duplicates,
      blank,
      groups: [...groups.entries()]
        .map(([name, v]) => ({ name, ...v, value: mi >= 0 ? v.sum : v.count }))
        .sort((a, b) => b.value - a.value),
    };
  }, [rows, columns, group, measure]);
  const visible = columns
      .map((name, i) => ({ name, i }))
      .filter((c) => !hidden.includes(c.name)),
    max = Math.max(1, ...stats.groups.map((g) => Math.abs(g.value))),
    pages = Math.max(1, Math.ceil(rows.length / 50));
  return (
    <section className="excel-studio">
      <div className="page-heading">
        <div>
          <h1>IMS Excel workspace</h1>
          <p>
            Your familiar worksheets. Clearer insights. Verified operational
            actions.
          </p>
        </div>
        <Link href="/imports" className="secondary">
          Import into ELMS
        </Link>
      </div>
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label="Excel workspace mode"
      >
        {[
          ["workbook", "Workbook analysis"],
          ["dispatches", "Live dispatch grid"],
          ["students", "Student register"],
        ]
          .filter(([id]) => id !== "students" || has("students:read"))
          .map(([id, title]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              <FileSpreadsheet size={16} />
              {title}
            </button>
          ))}
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
          <button onClick={() => void refresh()}>Retry</button>
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
      {tab !== "workbook" ? (
        <div className="live-grid">
          <ResourceView key={tab} resource={tab} lookups={lookups} />
        </div>
      ) : (
        <>
          <div className="sheet-commandbar">
            <label className="inline-field">
              Workbook
              <select
                aria-label="Open workbook"
                value={book?.id ?? ""}
                onChange={async (e) => {
                  if (!e.target.value) return;
                  try {
                    open(
                      await request<Workbook>(`/workbooks/${e.target.value}`),
                    );
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              >
                <option value="">Choose a saved workbook</option>
                {list.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            {has("import:write") && (
              <button
                className="secondary"
                aria-pressed={textReview}
                onClick={() => setTextReview(!textReview)}
              >
                Structure text
              </button>
            )}
            {has("import:write") && (
              <label
                className={`primary file-button ${busy ? "disabled" : ""}`}
              >
                <Upload size={16} />
                {busy ? "Analysing…" : "Upload workbook"}
                <input
                  aria-label="Upload IMS workbook"
                  type="file"
                  disabled={busy}
                  accept=".xlsx,.xls,.csv,.pdf,.docx"
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            <label className="inline-field">
              Template
              <select
                aria-label="Download Excel template"
                value=""
                onChange={async (e) => {
                  if (e.target.value)
                    try {
                      await download(
                        `/workbook-templates/${e.target.value}`,
                        `ims-${e.target.value}-template.xlsx`,
                      );
                    } catch (err) {
                      setError((err as Error).message);
                    }
                }}
              >
                <option value="">Download template</option>
                {["students", "payments", "items", "pincodes"].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {textReview && (
            <TextWorkbook
              onClose={() => setTextReview(false)}
              onCreated={async (id) => {
                try {
                  open(await request<Workbook>(`/workbooks/${id}`));
                  await refresh();
                  setTextReview(false);
                  setNotice("Reviewed text saved as a private worksheet.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          )}
          {!book ? (
            <div
              className="workbook-empty"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (has("import:write")) void upload(e.dataTransfer.files[0]);
              }}
            >
              <div className="excel-mark">
                <FileSpreadsheet size={40} />
              </div>
              <h2>Bring your IMS workbook into focus</h2>
              <p>
                Drop Excel or CSV here. Explore every sheet, compare course and
                centre totals, inspect duplicates, and save your view.
              </p>
              <div className="empty-capabilities">
                <span>Multiple sheets</span>
                <span>Custom headers</span>
                <span>Charts & totals</span>
                <span>Data quality</span>
              </div>
              <p className="small-note">
                Private to your account · 5 MB · 1000 data rows per workbook.
                Original IMS layouts work without an operational import mapping.
              </p>
            </div>
          ) : (
            <>
              <div className="workbook-title">
                <div>
                  <strong>{book.name}</strong>
                  <span>
                    {book.sheets.length} sheets · uploaded{" "}
                    {date(book.createdAt)}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="secondary small"
                    aria-pressed={sharing}
                    onClick={() => setSharing(!sharing)}
                  >
                    Share insights
                  </button>
                  <button
                    className="secondary small"
                    aria-pressed={explore}
                    onClick={() => setExplore(!explore)}
                  >
                    Analysis workbench
                  </button>
                  {has("reports:export") && (
                    <button
                      className="secondary small"
                      onClick={() =>
                        download(
                          `/workbooks/${book.id}/export`,
                          "ims-workbook.xlsx",
                        ).catch((e) => setError(e.message))
                      }
                    >
                      <Download size={15} />
                      Excel
                    </button>
                  )}
                  <button
                    className="secondary small"
                    onClick={() => setDrawer(!drawer)}
                    aria-pressed={drawer}
                  >
                    <PanelRight size={15} />
                    Analysis
                  </button>
                  {has("import:write") && (
                    <button
                      className="icon-button"
                      title="Delete private workbook"
                      aria-label="Delete workbook"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "Delete this private workbook? Operational records remain unchanged.",
                          )
                        )
                          return;
                        try {
                          await request(`/workbooks/${book.id}`, {
                            method: "DELETE",
                          });
                          setBook(null);
                          await refresh();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="sheet-tabs">
                {book.sheets.map((s, i) => (
                  <button
                    key={i}
                    className={sheet === i ? "active" : ""}
                    onClick={() => {
                      setSheet(i);
                      setHeader(0);
                      setPage(1);
                      setSort(null);
                      setFilters([]);
                      setFilterCol("");
                      setFilterValue("");
                      setHidden([]);
                      setGroup("");
                      setMeasure("");
                    }}
                  >
                    <FileSpreadsheet size={14} />
                    {s.name}
                    <span>{Math.max(0, s.rows.length - 1)}</span>
                  </button>
                ))}
              </div>
              <div className="sheet-filterbar">
                <label className="search">
                  <Search size={16} />
                  <input
                    aria-label="Search workbook rows"
                    placeholder="Search this worksheet"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label>
                  Header row
                  <select
                    aria-label="Worksheet header row"
                    value={header}
                    onChange={(e) => {
                      setHeader(Number(e.target.value));
                      setFilters([]);
                      setPage(1);
                      setHidden([]);
                      setGroup("");
                      setMeasure("");
                      setFilterCol("");
                      setFilterValue("");
                      setSort(null);
                    }}
                  >
                    {matrix.slice(0, 30).map((_, i) => (
                      <option key={i} value={i}>
                        Row {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <select
                  aria-label="Filter worksheet column"
                  value={filterCol}
                  onChange={(e) => {
                    setFilterCol(e.target.value);
                    setFilterValue("");
                    setPage(1);
                  }}
                >
                  <option value="">Filter a column</option>
                  {columns.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                {filterCol && (
                  <select
                    aria-label="Filter worksheet value"
                    value={filterValue}
                    onChange={(e) => {
                      setFilterValue(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All values</option>
                    {[
                      ...new Set(
                        base.map((r) => r[columns.indexOf(filterCol)] ?? ""),
                      ),
                    ]
                      .sort()
                      .map((v) => (
                        <option key={v} value={v}>
                          {v || "(blank)"}
                        </option>
                      ))}
                  </select>
                )}
                <details className="column-picker">
                  <summary>
                    Columns <ChevronDown size={14} />
                  </summary>
                  <div>
                    {columns.map((c) => (
                      <label key={c}>
                        <input
                          type="checkbox"
                          checked={!hidden.includes(c)}
                          onChange={(e) =>
                            setHidden(
                              e.target.checked
                                ? hidden.filter((h) => h !== c)
                                : hidden.length < columns.length - 1
                                  ? [...hidden, c]
                                  : hidden,
                            )
                          }
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </details>
                {has("reports:export") && (
                  <button
                    className="text-button"
                    onClick={() =>
                      download(
                        `/workbooks/${book.id}/export-view`,
                        "ims-filtered-view.csv",
                        {
                          method: "POST",
                          body: JSON.stringify({
                            sheet,
                            header,
                            columns: visible.map((c) => c.i),
                            rows: rows.map((r) => r.index - 1),
                          }),
                        },
                      ).catch((e) => setError(e.message))
                    }
                  >
                    Export filtered CSV
                  </button>
                )}
              </div>
              <FilterBuilder
                columns={columns}
                filters={filters}
                onChange={(v) => {
                  setFilters(v);
                  setPage(1);
                }}
              />
              {sharing && (
                <ShareInsights
                  onClose={() => setSharing(false)}
                  summary={`Workbook: ${book.name}\nWorksheet: ${book.sheets[sheet]?.name}\nMatching records: ${rows.length} / ${base.length}\n${filters.length ? "Conditions: " + filters.map((f) => `${f.column.slice(0, 40)} ${f.operator} ${f.value.slice(0, 40)}`).join("; ") + "\n" : ""}Grouped ${measure ? `sums of ${measure}` : "record counts"} by ${group || "all records"}:\n${stats.groups
                    .slice(0, 10)
                    .map(
                      (g) =>
                        `${g.name.slice(0, 60)}: ${g.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
                    )
                    .join(
                      "\n",
                    )}\nQuality: ${stats.duplicates} duplicate complete rows; ${stats.blank} blank cells.\nReviewed analytical data; source records are not changed.`}
                />
              )}
              {explore && (
                <AnalyticsWorkbench
                  rows={rows.map((r) => r.cells)}
                  columns={columns}
                  group={group}
                  measure={measure}
                  chart={chart}
                  aggregate={aggregate}
                  onGroup={setGroup}
                  onMeasure={setMeasure}
                  onChart={setChart}
                  onAggregate={setAggregate}
                />
              )}
              <div className={`sheet-layout ${drawer ? "with-analysis" : ""}`}>
                <div className="worksheet">
                  <div className="worksheet-caption">
                    <span>
                      {rows.length.toLocaleString("en-IN")} /{" "}
                      {base.length.toLocaleString("en-IN")} records
                    </span>
                    <span>Click a column header to sort</span>
                  </div>
                  <div className="table-scroll">
                    <table className="sheet-table">
                      <thead>
                        <tr>
                          <th className="row-number">#</th>
                          {visible.map((c) => (
                            <th key={c.name}>
                              <button
                                onClick={() =>
                                  setSort({
                                    col: c.i,
                                    asc: sort?.col === c.i ? !sort.asc : true,
                                  })
                                }
                              >
                                {c.name}
                                <ArrowUpDown size={12} />
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows
                          .slice(
                            (Math.min(page, pages) - 1) * 50,
                            Math.min(page, pages) * 50,
                          )
                          .map((r) => (
                            <tr key={r.index}>
                              <td className="row-number">{r.index}</td>
                              {visible.map((c) => (
                                <td
                                  key={c.name}
                                  className={
                                    numericValue(r.cells[c.i] ?? "") !== null
                                      ? "numeric"
                                      : ""
                                  }
                                  tabIndex={0}
                                  title={r.cells[c.i] ?? ""}
                                >
                                  {r.cells[c.i] || (
                                    <span className="blank-cell">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!rows.length && (
                    <div className="empty compact">
                      <p>No rows match these filters.</p>
                    </div>
                  )}
                  <div className="pagination">
                    <span>
                      Page {Math.min(page, pages)} of {pages} · 50 rows per page
                    </span>
                    <div>
                      <button
                        className="secondary small"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </button>
                      <button
                        className="secondary small"
                        disabled={page >= pages}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
                {drawer && (
                  <aside className="analysis-drawer">
                    <div className="panel-heading">
                      <h2>
                        <ChartColumn size={18} />
                        Worksheet insights
                      </h2>
                    </div>
                    <label>
                      Group by
                      <select
                        aria-label="Chart group column"
                        value={group}
                        onChange={(e) => setGroup(e.target.value)}
                      >
                        <option value="">All records</option>
                        {columns.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Measure
                      <select
                        aria-label="Chart measure"
                        value={measure}
                        onChange={(e) => setMeasure(e.target.value)}
                      >
                        <option value="">Record count</option>
                        {columns
                          .filter((_, i) =>
                            base.some((r) => numericValue(r[i] ?? "") !== null),
                          )
                          .map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                      </select>
                    </label>
                    <p className="small-note">
                      {measure
                        ? `Sum of numeric ${measure} values; blank/non-numeric cells excluded.`
                        : "Count of filtered records in each group."}
                    </p>
                    <div
                      className="horizontal-bars"
                      aria-label="Worksheet grouping chart"
                    >
                      {stats.groups.slice(0, 12).map((g) => (
                        <div key={g.name}>
                          <div>
                            <span title={g.name}>{g.name}</span>
                            <strong>
                              {g.value.toLocaleString("en-IN", {
                                maximumFractionDigits: 2,
                              })}
                            </strong>
                          </div>
                          <div className="track">
                            <span
                              style={{
                                width: `${(Math.abs(g.value) / max) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {stats.groups.length > 12 && (
                      <p className="small-note">
                        Top 12 groups shown. Export the filtered grid for all
                        records.
                      </p>
                    )}
                    <div className="quality-summary">
                      <h3>
                        <AlertTriangle size={16} />
                        Quality checks
                      </h3>
                      <dl>
                        <div>
                          <dt>Duplicate complete rows</dt>
                          <dd>{stats.duplicates}</dd>
                        </div>
                        <div>
                          <dt>Blank cells</dt>
                          <dd>{stats.blank}</dd>
                        </div>
                        <div>
                          <dt>Visible columns</dt>
                          <dd>
                            {visible.length}/{columns.length}
                          </dd>
                        </div>
                      </dl>
                      <p>No rows are removed or committed automatically.</p>
                    </div>
                    {has("import:write") && (
                      <div className="saved-view">
                        <label>
                          Workbook name
                          <input
                            aria-label="Workbook name"
                            value={name}
                            maxLength={150}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </label>
                        <button
                          className="primary"
                          onClick={async () => {
                            try {
                              const b = await request<Workbook>(
                                `/workbooks/${book.id}`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify({
                                    name,
                                    view: {
                                      sheet,
                                      header,
                                      group,
                                      measure,
                                      hidden,
                                      chart,
                                      aggregate,
                                      filters,
                                    },
                                  }),
                                },
                              );
                              setBook(b);
                              await refresh();
                              setNotice(
                                "Workbook layout and analysis preferences saved.",
                              );
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          <Save size={15} />
                          Save view
                        </button>
                      </div>
                    )}
                  </aside>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
