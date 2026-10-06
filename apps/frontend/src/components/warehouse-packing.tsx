"use client";
import { useEffect, useState } from "react";
import { PackageCheck, RefreshCw } from "lucide-react";
import { request, post, type Row } from "../lib/client";
import { Table, type Lookups } from "./resource-view";
import { options } from "./forms";
export function WarehousePacking({ lookups }: { lookups: Lookups }) {
  const [rows, setRows] = useState<Row[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [warehouse, setWarehouse] = useState(""),
    [search, setSearch] = useState(""),
    [count, setCount] = useState("100"),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      request<Row[]>(
        `/warehouse-packing?${new URLSearchParams({ search, count })}`,
        { signal: controller.signal },
      )
        .then((r) => {
          setRows(r);
          setSelected([]);
        })
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
  }, [search, count, version]);
  async function pack() {
    if (
      !window.confirm(
        `Pack ${selected.length} cleared kits from the selected warehouse? Usable stock will be deducted atomically.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await post<{ updated: number }>("/warehouse-packing", {
        ids: selected,
        warehouseId: warehouse,
      });
      setNotice(
        `${r.updated} kits packed. Stock, movement ledger and audit committed.`,
      );
      setVersion(version + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Warehouse packing station</h1>
          <p>
            Pack cleared kits from one warehouse. Payment checks stay on the
            server.
          </p>
        </div>
        <button className="secondary" onClick={() => setVersion(version + 1)}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
      <div className="panel">
        <div className="filters">
          <input
            aria-label="Search packing queue"
            placeholder="Student reference or kit name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label>
            Show cleared kits
            <select value={count} onChange={(e) => setCount(e.target.value)}>
              <option value="100">100</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
            </select>
          </label>
          <label>
            Packing warehouse
            <select
              aria-label="Packing station warehouse"
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
            >
              <option value="">Choose warehouse</option>
              {options(lookups.centers).map((c) => (
                <option value={c.value} key={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-toolbar">
          <span>
            {rows.length} cleared kits · {selected.length} selected
          </span>
          <button
            className="primary small"
            disabled={busy || !warehouse || !selected.length}
            onClick={pack}
          >
            <PackageCheck size={16} />
            {busy ? "Checking…" : "Pack selected kits"}
          </button>
        </div>
        {busy ? (
          <div className="loading-block" role="status">
            Loading packing queue…
          </div>
        ) : rows.length ? (
          <Table
            columns={[
              { label: "Student reference", path: "studentId" },
              { label: "Kit", path: "kit.name" },
              { label: "Course", path: "kit.course.name" },
              { label: "Centre", path: "student.center.name" },
              {
                label: "Expected dispatch",
                path: "expectedDispatch",
                type: "date",
              },
            ]}
            rows={rows}
            selected={selected}
            onSelect={setSelected}
          />
        ) : (
          <div className="empty">
            <PackageCheck size={30} />
            <h2>No cleared kits waiting to pack</h2>
            <p>
              Finance clearance and verified enrolments populate this queue.
              Your manager can reconcile it after configuration changes.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
