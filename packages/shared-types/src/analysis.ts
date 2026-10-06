export type TextMode = "delimited" | "keyvalue" | "lines";
export type DataFilter = {
  column: string;
  operator:
    | "contains"
    | "equals"
    | "not_equals"
    | "blank"
    | "not_blank"
    | "gt"
    | "lt"
    | "after"
    | "before";
  value: string;
};
export const numberValue = (value: string): number | null => {
  const cleaned = value.trim().replace(/[₹,$%\s]/g, "");
  const result =
    cleaned && /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
  return Number.isFinite(result) ? result : null;
};
export function matchesFilters(
  cells: string[],
  columns: string[],
  filters: DataFilter[],
) {
  return filters.every((f) => {
    const index = columns.indexOf(f.column);
    if (index < 0) return false;
    const value = (cells[index] ?? "").trim(),
      target = f.value.trim();
    switch (f.operator) {
      case "blank":
        return !value;
      case "not_blank":
        return !!value;
      case "contains":
        return value.toLowerCase().includes(target.toLowerCase());
      case "equals":
        return value.toLowerCase() === target.toLowerCase();
      case "not_equals":
        return value.toLowerCase() !== target.toLowerCase();
      case "gt":
      case "lt": {
        const a = numberValue(value),
          b = numberValue(target);
        return (
          a !== null && b !== null && (f.operator === "gt" ? a > b : a < b)
        );
      }
      case "after":
      case "before": {
        // Only ISO dates are compared; ambiguous day/month text stays excluded.
        if (
          !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) ||
          !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(target)
        )
          return false;
        const a = Date.parse(value),
          b = Date.parse(target);
        return (
          Number.isFinite(a) &&
          Number.isFinite(b) &&
          (f.operator === "after" ? a > b : a < b)
        );
      }
    }
  });
}
export function columnProfile(values: string[]) {
  const populated = values.map((v) => v.trim()).filter(Boolean);
  const numeric = populated
    .map(numberValue)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const mean = numeric.length
    ? numeric.reduce((a, b) => a + b, 0) / numeric.length
    : null;
  return {
    blank: values.length - populated.length,
    distinct: new Set(populated).size,
    numeric: numeric.length,
    type: !populated.length
      ? "Empty"
      : numeric.length === populated.length
        ? "Numeric"
        : populated.every(
              (v) =>
                /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v) &&
                Number.isFinite(Date.parse(v)),
            )
          ? "ISO date"
          : numeric.length
            ? "Mixed"
            : "Text",
    min: numeric[0] ?? null,
    max: numeric[numeric.length - 1] ?? null,
    mean,
    median: numeric.length
      ? ((numeric[Math.floor((numeric.length - 1) / 2)] ?? 0) +
          (numeric[Math.floor(numeric.length / 2)] ?? 0)) /
        2
      : null,
    standardDeviation:
      mean === null
        ? null
        : Math.sqrt(
            numeric.reduce((a, b) => a + (b - mean) ** 2, 0) / numeric.length,
          ),
  };
}
export function parseTextTable(
  text: string,
  mode: TextMode,
  delimiter = ",",
  hasHeader = true,
): string[][] {
  if (text.length > 100000)
    throw new Error("Keep text within 100000 characters");
  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  let rows: string[][] = [];
  if (mode === "lines")
    rows = [
      ["Source line"],
      ...text
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => [l.trim()]),
    ];
  else if (mode === "keyvalue") {
    const records: Record<string, string>[] = [],
      keys = new Set<string>();
    let record: Record<string, string> = {};
    const flush = () => {
      if (Object.keys(record).length) records.push(record);
      record = {};
    };
    for (const line of text.split("\n")) {
      if (!line.trim()) {
        flush();
        continue;
      }
      for (const part of line.split(/[;|]\s*(?=[\w][\w\s-]{0,40}[:=])/)) {
        const match = part.match(/^\s*([^:=]{1,50})\s*[:=]\s*(.*)$/);
        if (!match)
          throw new Error(
            "Every nonblank line needs a Key: value pair. Choose source lines for prose.",
          );
        const key = (match[1] ?? "").trim();
        if (Object.prototype.hasOwnProperty.call(record, key)) flush();
        record[key] = (match[2] ?? "").trim();
        keys.add(key);
      }
    }
    flush();
    const headers = [...keys];
    rows = [headers, ...records.map((r) => headers.map((k) => r[k] ?? ""))];
  } else {
    if (![",", "\t", ";", "|"].includes(delimiter))
      throw new Error("Choose a supported delimiter");
    let row: string[] = [],
      cell = "",
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (!quoted && cell.trim())
          throw new Error(
            "Unexpected quote; review delimiter or use source lines",
          );
        else quoted = !quoted;
      } else if (c === delimiter && !quoted) {
        row.push(cell.trim());
        cell = "";
      } else if (c === "\n" && !quoted) {
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = "";
      } else cell += c;
    }
    if (quoted) throw new Error("Unclosed quoted field; review source text");
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    if (!hasHeader && rows.length)
      rows.unshift(
        Array.from(
          { length: Math.max(...rows.map((r) => r.length)) },
          (_, i) => `Column ${i + 1}`,
        ),
      );
  }
  if (rows.length < 2 || !rows[0]?.length)
    throw new Error("Include a header and at least one record");
  const width = Math.max(...rows.map((r) => r.length));
  if (
    rows.length > 1001 ||
    width > 100 ||
    rows.some((r) => r.some((c) => c.length > 2000))
  )
    throw new Error(
      "Limit: 1000 records, 100 columns, 2000 characters per cell",
    );
  return rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
}
