"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CircleCheck,
  Clock3,
  Package,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { request, type Row, read, date, label } from "../lib/client";
import { Badge, Filters, type Lookups } from "./resource-view";
interface DashboardData {
  activeStudents: number;
  ready: number;
  readyStudents: number;
  dispatchedWeek: number;
  dispatchedMonth: number;
  blocked: number;
  openTransfers: number;
  pendingPrint: number;
  lowStock: Row[];
  statuses: Record<string, number>;
  monthly: { month: string; count: number }[];
  courierPerformance: { name: string; total: number; delivered: number }[];
  activity: Row[];
  courses: Row[];
  centers: Row[];
  centerDispatches: { name: string; count: number }[];
  courseMilestones: { name: string; total: number; cleared: number }[];
}
export function Dashboard({ lookups }: { lookups: Lookups }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    const load = () =>
      request<DashboardData>(`/dashboard?${new URLSearchParams(values)}`)
        .then((d) => {
          if (live) {
            setData(d);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    void load();
    const timer = setInterval(load, 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [values, version]);
  if (!data)
    return (
      <section>
        <div className="page-heading">
          <div>
            <h1>Operations overview</h1>
            <p>Live visibility across the material journey.</p>
          </div>
        </div>
        {error ? (
          <div role="alert" className="alert error">
            {error}
            <button onClick={() => setVersion((v) => v + 1)}>Retry</button>
          </div>
        ) : (
          <div className="loading-block" role="status">
            Loading live operations…
          </div>
        )}
      </section>
    );
  const inTransit = [
    "HANDED_TO_COURIER",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
  ].reduce((n, s) => n + (data.statuses[s] ?? 0), 0);
  const delivered = data.statuses.DELIVERED ?? 0;
  const max = Math.max(1, ...data.monthly.map((m) => m.count));
  const total = Object.values(data.statuses).reduce((n, c) => n + c, 0);
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Operations overview</h1>
          <p>
            Keep materials moving. Resolve exceptions before they reach
            students.
          </p>
        </div>
        <Link href="/dispatches" className="primary">
          <Package size={17} />
          Open dispatch desk
          <ArrowUpRight size={16} />
        </Link>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="dashboard-filters">
        <Filters
          lookups={lookups}
          values={values}
          search={false}
          courier
          onChange={(k, v) => setValues(k === "*" ? {} : { ...values, [k]: v })}
        />
      </div>
      <div className="metrics">
        <Metric
          title="Active students"
          value={data.activeStudents}
          note="Across selected courses & centres"
          icon={<Package size={20} />}
        />
        <Metric
          title="Students dispatch ready"
          value={data.readyStudents}
          note={`${data.ready} cleared kits waiting to pack`}
          icon={<CircleCheck size={20} />}
        />
        <Metric
          title="Students blocked"
          value={data.blocked}
          note="Payment pending or enrolment on hold"
          icon={<TriangleAlert size={20} />}
          warn
        />
        <Metric
          title="In transit"
          value={inTransit}
          note="Handed over through out for delivery"
          icon={<Truck size={20} />}
        />
      </div>
      <div className="dispatch-board">
        <div className="dispatch-period">
          <span>
            Handed over this week <strong>{data.dispatchedWeek}</strong>
          </span>
          <span>
            This month <strong>{data.dispatchedMonth}</strong>
          </span>
          <Link href="/exceptions" className="text-button">
            Review exceptions <ArrowUpRight size={14} />
          </Link>
        </div>
        <div>
          <h2>Today’s operational priorities</h2>
          <p>From readiness to delivery, without losing the handover.</p>
        </div>
        <div className="stages">
          {[
            ["QUEUED", "Ready to pack"],
            ["PACKED", "Ready for handover"],
            ["IN_TRANSIT", "In transit"],
            ["DELIVERED", "Delivered"],
          ].map(([s, t]) => (
            <Link href={`/dispatches?status=${s}`} key={s}>
              <span className={`stage-dot ${s.toLowerCase()}`} />
              <span>{t}</span>
              <strong>{(data.statuses[s] ?? 0).toLocaleString("en-IN")}</strong>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
      </div>
      <div className="dashboard-grid">
        <article className="panel span-two">
          <div className="panel-heading">
            <div>
              <h2>Course student distribution</h2>
              <p>Active enrolments in selected courses and centres</p>
            </div>
            <Link href="/excel" className="text-button">
              Explore in IMS Excel <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="course-distribution">
            {data.courses.length ? (
              data.courses.map((c) => (
                <div key={String(c.courseId)}>
                  <strong>
                    {String(
                      lookups.courses.find((l) => l.id === c.courseId)?.name ??
                        c.courseId,
                    )}
                  </strong>
                  <span>
                    {Number(c._count).toLocaleString("en-IN")} students
                  </span>
                  <div className="track">
                    <span
                      style={{
                        width: `${(Number(c._count) / Math.max(1, data.activeStudents)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">
                Course distribution appears after Admissions synchronization.
              </p>
            )}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Course payment milestones</h2>
              <p>Cleared milestones by course · current enrolments</p>
            </div>
          </div>
          <div className="courier-list">
            {data.courseMilestones.length ? (
              data.courseMilestones.map((c) => (
                <div key={c.name}>
                  <strong>{c.name}</strong>
                  <span>
                    {c.cleared} / {c.total} cleared
                  </span>
                  <progress
                    value={c.cleared}
                    max={Math.max(1, c.total)}
                    aria-label={`${c.name} cleared milestones`}
                  />
                  <b>{Math.round((c.cleared / Math.max(1, c.total)) * 100)}%</b>
                </div>
              ))
            ) : (
              <p className="muted">
                Milestones appear after Finance synchronization.
              </p>
            )}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Centre dispatch volume</h2>
              <p>All-time shipments across selected courses and centres</p>
            </div>
          </div>
          <div className="attention-list">
            {data.centerDispatches.length ? (
              data.centerDispatches.map((c) => (
                <div
                  key={c.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px 0",
                  }}
                >
                  <span>{c.name}</span>
                  <strong>{c.count.toLocaleString("en-IN")}</strong>
                </div>
              ))
            ) : (
              <p className="muted">
                Centre totals appear when shipments enter the queue.
              </p>
            )}
          </div>
        </article>
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Dispatch volume</h2>
              <p>Shipments created over the last 12 months</p>
            </div>
            <Badge value="Monthly" />
          </div>
          {data.monthly.length ? (
            <div
              className="bar-chart"
              role="img"
              aria-label={data.monthly
                .map((m) => `${m.month}: ${m.count} shipments`)
                .join(", ")}
            >
              {Array.from({ length: 12 }, (_, i) => {
                const now = new Date();
                const d = new Date(
                  Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1),
                );
                const key = d.toISOString().slice(0, 7);
                const count =
                  data.monthly.find((m) => m.month === key)?.count ?? 0;
                return (
                  <div key={key}>
                    <span className="bar-count">{count || ""}</span>
                    <div className="bar-space">
                      <div
                        className="bar"
                        style={{ height: `${(count / max) * 100}%` }}
                      />
                    </div>
                    <span>
                      {d.toLocaleString("en-IN", {
                        month: "short",
                        timeZone: "UTC",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty compact">
              <Clock3 size={28} />
              <p>
                Dispatch trends appear after the first shipment enters the
                queue.
              </p>
            </div>
          )}
        </article>
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Shipment outcomes</h2>
              <p>Selected operational period</p>
            </div>
          </div>
          <div className="outcome">
            <div
              className="donut"
              role="img"
              aria-label={`${delivered} delivered, ${inTransit} in transit, ${total - delivered - inTransit} other shipments`}
              style={{
                background: total
                  ? `conic-gradient(var(--teal) 0 ${(delivered / total) * 100}%, var(--blue) ${(delivered / total) * 100}% ${((delivered + inTransit) / total) * 100}%,var(--line) ${((delivered + inTransit) / total) * 100}% 100%)`
                  : "var(--line)",
              }}
            >
              <div>
                <strong>{total}</strong>
                <span>shipments</span>
              </div>
            </div>
            <ul>
              <li>
                <i className="dot teal" />
                Delivered<strong>{delivered}</strong>
              </li>
              <li>
                <i className="dot blue" />
                In transit<strong>{inTransit}</strong>
              </li>
              <li>
                <i className="dot" />
                Other stages<strong>{total - delivered - inTransit}</strong>
              </li>
            </ul>
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Needs attention</h2>
              <p>Exceptions requiring an operational decision</p>
            </div>
            <TriangleAlert size={20} />
          </div>
          <div className="attention-list">
            <Link href="/transfers">
              <span>
                Open course transfers
                <small>Review material cost and target course credit</small>
              </span>
              <strong>{data.openTransfers}</strong>
            </Link>
            <Link href="/dispatches?status=FAILED_DELIVERY">
              <span>
                Failed deliveries
                <small>Retry contact or initiate a return</small>
              </span>
              <strong>{data.statuses.FAILED_DELIVERY ?? 0}</strong>
            </Link>
            <Link href="/inventory">
              <span>
                Low-stock balances
                <small>Plan printing before the next packing run</small>
              </span>
              <strong>{data.lowStock.length}</strong>
            </Link>
            <Link href="/requisitions">
              <span>
                Open vendor requisitions
                <small>Confirm material received from vendors</small>
              </span>
              <strong>{data.pendingPrint}</strong>
            </Link>
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent shipment activity</h2>
              <p>Latest recorded changes</p>
            </div>
          </div>
          {data.activity.length ? (
            <ul className="activity">
              {data.activity.map((a) => (
                <li key={String(a.id)}>
                  <span className="activity-symbol">
                    <Package size={16} />
                  </span>
                  <div>
                    <strong>{String(read(a, "dispatch.student.name"))}</strong>
                    <p>
                      {String(read(a, "dispatch.kit.name"))} · {label(a.status)}
                    </p>
                    <time>{date(a.timestamp)}</time>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty compact">
              <p>Shipment events appear here as your team works.</p>
            </div>
          )}
        </article>
        <article className="panel span-two">
          <div className="panel-heading">
            <div>
              <h2>Courier performance</h2>
              <p>Confirmed deliveries as a share of each partner’s shipments</p>
            </div>
            <Link className="text-button" href="/reports">
              View reports
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="courier-list">
            {data.courierPerformance.length ? (
              data.courierPerformance.map((c) => (
                <div key={c.name}>
                  <strong>{c.name}</strong>
                  <span>
                    {c.delivered} / {c.total} delivered
                  </span>
                  <progress
                    value={c.delivered}
                    max={Math.max(1, c.total)}
                    aria-label={`${c.name} delivery success`}
                  />
                  <b>
                    {c.total ? Math.round((c.delivered / c.total) * 100) : 0}%
                  </b>
                </div>
              ))
            ) : (
              <p className="muted">
                Add courier partners and record deliveries to measure
                performance.
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
function Metric({
  title,
  value,
  note,
  icon,
  warn,
}: {
  title: string;
  value: number;
  note: string;
  icon: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <article className={`metric ${warn ? "warn" : ""}`}>
      <div>
        <span>{title}</span>
        {icon}
      </div>
      <strong>{value.toLocaleString("en-IN")}</strong>
      <p>{note}</p>
    </article>
  );
}
