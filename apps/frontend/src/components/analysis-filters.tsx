"use client";
import { Plus, X, SlidersHorizontal } from "lucide-react";
import type { DataFilter } from "shared-types";
export function FilterBuilder({
  columns,
  filters,
  onChange,
}: {
  columns: string[];
  filters: DataFilter[];
  onChange: (filters: DataFilter[]) => void;
}) {
  return (
    <details className="advanced-filters">
      <summary>
        <SlidersHorizontal size={15} /> Advanced filters{" "}
        <span>
          {filters.length ? `${filters.length} active` : "Combine conditions"}
        </span>
      </summary>
      <div className="filter-builder">
        <p className="small-note">
          All conditions must match. Date comparisons use ISO YYYY-MM-DD values.
        </p>
        {filters.map((f, i) => (
          <div className="filter-condition" key={i}>
            <select
              aria-label={`Filter column ${i + 1}`}
              value={f.column}
              onChange={(e) =>
                onChange(
                  filters.map((v, j) =>
                    j === i ? { ...v, column: e.target.value } : v,
                  ),
                )
              }
            >
              {columns.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label={`Filter operator ${i + 1}`}
              value={f.operator}
              onChange={(e) =>
                onChange(
                  filters.map((v, j) =>
                    j === i
                      ? {
                          ...v,
                          operator: e.target.value as DataFilter["operator"],
                        }
                      : v,
                  ),
                )
              }
            >
              {Object.entries({
                contains: "Contains",
                equals: "Equals",
                not_equals: "Does not equal",
                blank: "Is blank",
                not_blank: "Is not blank",
                gt: "Greater than",
                lt: "Less than",
                after: "After date",
                before: "Before date",
              }).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {!f.operator.includes("blank") && (
              <input
                aria-label={`Filter value ${i + 1}`}
                value={f.value}
                maxLength={2000}
                placeholder="Comparison value"
                onChange={(e) =>
                  onChange(
                    filters.map((v, j) =>
                      j === i ? { ...v, value: e.target.value } : v,
                    ),
                  )
                }
              />
            )}
            <button
              className="icon-button"
              aria-label={`Remove filter ${i + 1}`}
              onClick={() => onChange(filters.filter((_, j) => j !== i))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
        <div className="button-row">
          <button
            className="secondary small"
            disabled={!columns.length || filters.length >= 12}
            onClick={() =>
              onChange([
                ...filters,
                { column: columns[0] ?? "", operator: "contains", value: "" },
              ])
            }
          >
            <Plus size={15} />
            Add condition
          </button>
          {!!filters.length && (
            <button className="text-button" onClick={() => onChange([])}>
              Clear all conditions
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
