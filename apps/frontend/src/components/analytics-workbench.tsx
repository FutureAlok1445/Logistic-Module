"use client";
import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
} from "recharts";
import { ChartNoAxesCombined } from "lucide-react";
import { columnProfile, numberValue } from "shared-types";
export type ChartKind = "bar" | "line" | "area" | "histogram" | "scatter";
export type Aggregate = "sum" | "mean" | "min" | "max" | "count";
const format = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
export function AnalyticsWorkbench({
  rows,
  columns,
  group,
  measure,
  chart,
  aggregate,
  onGroup,
  onMeasure,
  onChart,
  onAggregate,
}: {
  rows: string[][];
  columns: string[];
  group: string;
  measure: string;
  chart: ChartKind;
  aggregate: Aggregate;
  onGroup: (v: string) => void;
  onMeasure: (v: string) => void;
  onChart: (v: ChartKind) => void;
  onAggregate: (v: Aggregate) => void;
}) {
  const [view, setView] = useState("visual"),
    [motion, setMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const profiles = useMemo(
    () =>
      columns.map((name, i) => ({
        name,
        ...columnProfile(rows.map((r) => r[i] ?? "")),
      })),
    [rows, columns],
  );
  const numeric = profiles.filter((p) => p.numeric > 0),
    gi = columns.indexOf(group),
    mi = columns.indexOf(measure);
  const groups = useMemo(() => {
    const map = new Map<string, { values: number[]; count: number }>();
    for (const r of rows) {
      const key = gi < 0 ? "All records" : r[gi] || "(blank)",
        entry = map.get(key) ?? { values: [], count: 0 };
      entry.count++;
      const v = numberValue(r[mi] ?? "");
      if (mi >= 0 && v !== null) entry.values.push(v);
      map.set(key, entry);
    }
    return [...map]
      .map(([name, g]) => {
        const sum = g.values.reduce((a, b) => a + b, 0);
        return {
          name,
          count: g.count,
          sum,
          mean: g.values.length ? sum / g.values.length : null,
          min: g.values.length ? Math.min(...g.values) : null,
          max: g.values.length ? Math.max(...g.values) : null,
          value:
            mi < 0 || aggregate === "count"
              ? g.count
              : aggregate === "sum"
                ? sum
                : aggregate === "mean"
                  ? g.values.length
                    ? sum / g.values.length
                    : null
                  : aggregate === "min"
                    ? g.values.length
                      ? Math.min(...g.values)
                      : null
                    : g.values.length
                      ? Math.max(...g.values)
                      : null,
        };
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      );
  }, [rows, gi, mi, aggregate]);
  const histogram = useMemo(() => {
    const values = rows
      .map((r) => numberValue(r[mi] ?? ""))
      .filter((v): v is number => v !== null);
    if (!values.length) return [];
    const min = Math.min(...values),
      max = Math.max(...values),
      step = (max - min) / 10 || 1;
    const bins = Array.from({ length: max === min ? 1 : 10 }, (_, i) => ({
      name: `${format(min + i * step)} – ${format(min + (i + 1) * step)}`,
      value: 0,
    }));
    for (const v of values)
      bins[Math.min(bins.length - 1, Math.floor((v - min) / step))]!.value++;
    return bins;
  }, [rows, mi]);
  const scatter = useMemo(
    () =>
      rows
        .map((r, i) => ({
          x: numberValue(r[gi] ?? ""),
          y: numberValue(r[mi] ?? ""),
          sourceRow: i + 1,
        }))
        .filter((p) => p.x !== null && p.y !== null),
    [rows, gi, mi],
  );
  const chartRows = (chart === "histogram" ? histogram : groups).map(({name,value})=>({name,value}));
  const axes = (
    <>
      <CartesianGrid stroke="var(--line)" vertical={false} />
      <XAxis
        dataKey="name"
        tick={{ fontSize: 11, fill: "var(--muted)" }}
        minTickGap={30}
      />
      <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} width={64} />
      <Tooltip
        contentStyle={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 8,
        }}
      />
      <Brush
        dataKey="name"
        height={22}
        stroke="var(--teal)"
        travellerWidth={8}
      />
    </>
  );
  return (
    <section className="analytics-workbench" aria-label="Analysis workbench">
      <div className="analysis-heading">
        <div>
          <h2>
            <ChartNoAxesCombined size={20} /> Explore this worksheet
          </h2>
          <p>
            Compare distributions, inspect fields and review grouped results.
          </p>
        </div>
        <div className="segmented">
          {["visual", "profile", "pivot"].map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === "visual"
                ? "Visualise"
                : v === "profile"
                  ? "Column profile"
                  : "Pivot summary"}
            </button>
          ))}
        </div>
      </div>
      <ol className="analysis-pipeline">
        <li>
          Source <strong>{rows.length} filtered rows</strong>
        </li>
        <li>
          Review <strong>{columns.length} fields</strong>
        </li>
        <li>
          Aggregate <strong>{aggregate}</strong>
        </li>
        <li>
          Visualise <strong>{chart}</strong>
        </li>
      </ol>
      <div className="analysis-controls">
        <label>
          Chart type
          <select
            aria-label="Visualisation type"
            value={chart}
            onChange={(e) => onChart(e.target.value as ChartKind)}
          >
            {["bar", "line", "area", "histogram", "scatter"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          {chart === "scatter" ? "X field (numeric)" : "Group / ordered axis"}
          <select
            aria-label="Analysis group"
            value={group}
            onChange={(e) => onGroup(e.target.value)}
          >
            <option value="">All records</option>
            {columns.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          {chart === "scatter" ? "Y field (numeric)" : "Measure"}
          <select
            aria-label="Analysis measure"
            value={measure}
            onChange={(e) => onMeasure(e.target.value)}
          >
            <option value="">Record count</option>
            {numeric.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </select>
        </label>
        <label>
          Aggregation
          <select
            aria-label="Analysis aggregation"
            value={aggregate}
            onChange={(e) => onAggregate(e.target.value as Aggregate)}
          >
            {["sum", "mean", "min", "max", "count"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      {view === "visual" ? (
        <>
          <p className="small-note">
            {chart === "scatter"
              ? `${scatter.length} numeric pairs. Other rows excluded.`
              : chart === "histogram"
                ? "Distribution across ten equal-width bins; nonnumeric cells excluded."
                : `${groups.length} groups, ordered by group label. Missing numeric values are excluded from numeric aggregates.`}{" "}
            Drag the lower range selector to inspect a smaller region.
          </p>
          {!rows.length ||
          ((chart === "scatter" || chart === "histogram") &&
            (!measure || (chart === "scatter" && !scatter.length))) ? (
            <div className="chart-empty">
              {!rows.length
                ? "No rows match. Adjust your filters."
                : "Select numeric fields to draw this chart."}
            </div>
          ) : (
            <div
              className="analysis-chart"
              role="img"
              aria-label={`${chart} chart of ${measure || "record count"} by ${group || "all records"}; ${rows.length} filtered rows`}
            >
              <ResponsiveContainer
                width="100%"
                height={340}
                minWidth={0}
                debounce={80}
              >
                {chart === "scatter" ? (
                  <ScatterChart
                    margin={{ top: 20, right: 24, left: 8, bottom: 20 }}
                  >
                    <CartesianGrid stroke="var(--line)" />
                    <XAxis type="number" dataKey="x" name={group} />
                    <YAxis type="number" dataKey="y" name={measure} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    <Scatter
                      data={scatter}
                      fill="var(--teal)"
                      isAnimationActive={motion}
                      animationDuration={500}
                    />
                  </ScatterChart>
                ) : chart === "line" ? (
                  <LineChart data={chartRows}>
                    {axes}
                    <Line
                      dataKey="value"
                      stroke="var(--teal)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      isAnimationActive={motion}
                      animationDuration={500}
                    />
                  </LineChart>
                ) : chart === "area" ? (
                  <AreaChart data={chartRows}>
                    {axes}
                    <Area
                      dataKey="value"
                      stroke="var(--teal)"
                      fill="var(--teal)"
                      fillOpacity={0.12}
                      isAnimationActive={motion}
                      animationDuration={500}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={chartRows}>
                    {axes}
                    <Bar
                      dataKey="value"
                      fill="var(--teal)"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={motion}
                      animationDuration={500}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
          <details className="chart-data">
            <summary>View chart data as a table</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{chart === "scatter" ? group : "Group / bin"}</th>
                    <th>{chart === "scatter" ? measure : "Value"}</th>
                  </tr>
                </thead>
                <tbody>
                  {chart === "scatter"
                    ? scatter.map((p, i) => (
                        <tr key={i}>
                          <td>{format(p.x)}</td>
                          <td>{format(p.y)}</td>
                        </tr>
                      ))
                    : chartRows.map((r, i) => (
                        <tr key={i}>
                          <td>{r.name}</td>
                          <td>{format(r.value)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : view === "profile" ? (
        <div className="table-scroll">
          <table aria-label="Column statistics">
            <thead>
              <tr>
                {[
                  "Field",
                  "Type",
                  "Blank",
                  "Distinct",
                  "Numeric",
                  "Min",
                  "Max",
                  "Mean",
                  "Median",
                  "Std. deviation",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.type}</td>
                  <td>{p.blank}</td>
                  <td>{p.distinct}</td>
                  <td>{p.numeric}</td>
                  {[p.min, p.max, p.mean, p.median, p.standardDeviation].map(
                    (v, i) => (
                      <td key={i} className="numeric">
                        {format(v)}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-scroll">
          <table aria-label="Pivot summary">
            <thead>
              <tr>
                {[group || "Group", "Rows", "Sum", "Mean", "Min", "Max"].map(
                  (v, i) => (
                    <th key={i}>{v}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.name}>
                  <td>{g.name}</td>
                  <td>{g.count}</td>
                  {[mi >= 0 ? g.sum : null, g.mean, g.min, g.max].map(
                    (v, i) => (
                      <td className="numeric" key={i}>
                        {format(v)}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
