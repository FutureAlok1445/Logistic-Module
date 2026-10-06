"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  BookOpen,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import { request, type Row, date } from "../lib/client";
import { useSession } from "./session";
import { Badge } from "./resource-view";
type Exceptions = {
  issues: Row[];
  counts: {
    failed: number;
    address: number;
    hold: number;
    overdue: number;
    lowStock: number;
  };
};
export function ExceptionsView() {
  const [data, setData] = useState<Exceptions | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    request<Exceptions>("/exceptions")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [version]);
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Exception desk</h1>
          <p>
            Prioritise failed delivery, blocked addresses, overdue shipments and
            low stock.
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
      {data ? (
        <>
          <div className="exception-summary">
            {Object.entries(data.counts).map(([key, count]) => (
              <div key={key}>
                <span>
                  {
                    (
                      {
                        failed: "Failed delivery",
                        address: "Address flags",
                        hold: "On hold",
                        overdue: "Delivery overdue",
                        lowStock: "Low stock",
                      } as Record<string, string>
                    )[key]
                  }
                </span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-heading">
              <h2>Action queue</h2>
              <Link href="/team" className="text-button">
                Assign follow-up work <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Student / material</th>
                    <th>Reference</th>
                    <th>Last update</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.issues.map((r) => (
                    <tr key={String(r.key)}>
                      <td>
                        <Badge value={r.kind} />
                      </td>
                      <td>{String(r.name)}</td>
                      <td>
                        <code>{String(r.reference)}</code>
                      </td>
                      <td>{date(r.updatedAt)}</td>
                      <td>
                        <Link className="text-button" href={String(r.href)}>
                          Review <ArrowUpRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.issues.length && (
              <div className="empty">
                <AlertTriangle size={28} />
                <h2>No current exceptions</h2>
                <p>Recorded issues appear here as operations progress.</p>
              </div>
            )}
            <p className="small-note" style={{ padding: 16 }}>
              Newest 50 shipment exceptions and 20 low-stock balances shown.
              Counts include all matching records.
            </p>
          </div>
        </>
      ) : (
        <div className="loading-block" role="status">
          Loading exceptions…
        </div>
      )}
    </section>
  );
}
export function HelpView() {
  const { user, has } = useSession();
  const links = [
    [
      "excel",
      "IMS Excel workspace",
      "Upload a private workbook, select its sheet/header, filter cells and compare totals. Analysis never changes Finance, Admissions or stock records.",
      FileSpreadsheet,
      "reports:read",
    ],
    [
      "imports",
      "Verified import",
      "Use templates and preview validation. Student/payment commits require the authorised department key; logistics cannot rewrite upstream records.",
      BookOpen,
      "import:write",
    ],
    [
      "dispatches",
      "Dispatch planning",
      "Reconcile eligible kits, select 100/500/1000 records, check the warehouse, pack atomically and obtain manager handover approval.",
      ShieldCheck,
      "dispatch:read",
    ],
    [
      "inventory",
      "Warehouse stock",
      "Receive or adjust goods with a reason. Inspect usable/damaged balances and the immutable movement ledger.",
      BookOpen,
      "inventory:read",
    ],
  ] as const;
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Employee guide</h1>
          <p>Practical steps for {user?.name} and the IMS logistics team.</p>
        </div>
        <Link href="/team" className="secondary">
          Ask your team
        </Link>
      </div>
      <div className="guide-list">
        {links
          .filter(([, , , , p]) => has(p))
          .map(([path, title, text, Icon]) => (
            <article key={path}>
              <Icon size={22} />
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
                <Link className="text-button" href={`/${path}`}>
                  Open {title.toLowerCase()} <ArrowUpRight size={14} />
                </Link>
              </div>
            </article>
          ))}
      </div>
      <div className="panel padded">
        <h2>When something is empty or blocked</h2>
        <dl className="help-definitions">
          <dt>No student records</dt>
          <dd>
            Admissions must provide enrolments linked to existing course, centre
            and payment-plan IDs.
          </dd>
          <dt>No eligible kits</dt>
          <dd>
            Finance milestones, course BOMs, valid addresses and postcode
            coverage must be present. Reconcile the queue after configuration.
          </dd>
          <dt>Messages waiting for configuration</dt>
          <dd>
            A manager must configure real SMTP/Twilio credentials and approved
            message templates. A pending provider is never shown as delivered.
          </dd>
          <dt>Excel formulas and linked sheets</dt>
          <dd>
            Analysis reads stored cell values. It does not execute macros,
            recalculate formulas or connect to external IMPORTRANGE sources.
            Export cached values from the source workbook first.
          </dd>
          <dt>Privacy and access</dt>
          <dd>
            Workbook uploads are private to their owner. General operational
            reports omit contact fields. Role permissions govern every server
            action.
          </dd>
        </dl>
      </div>
    </section>
  );
}
