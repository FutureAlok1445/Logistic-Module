"use client";
import { useMemo, useState } from "react";
import { parseTextTable, type TextMode } from "shared-types";
import { request } from "../lib/client";
import { FileText, X } from "lucide-react";
export function TextWorkbook({
  onCreated,
  onClose,
}: {
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(""),
    [name, setName] = useState("Reviewed source text"),
    [mode, setMode] = useState<TextMode>("delimited"),
    [delimiter, setDelimiter] = useState(","),
    [hasHeader, setHasHeader] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const preview = useMemo(() => {
    try {
      return {
        rows: parseTextTable(text, mode, delimiter, hasHeader),
        error: "",
      };
    } catch (e) {
      return { rows: [], error: (e as Error).message };
    }
  }, [text, mode, delimiter, hasHeader]);
  return (
    <section className="text-workbook" aria-label="Unstructured text review">
      <div className="analysis-heading">
        <div>
          <h2>
            <FileText size={20} /> Give source text a structure
          </h2>
          <p>
            Review the extraction before saving a private analytical worksheet.
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Close text review"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="analysis-controls">
        <label>
          Workbook name
          <input
            aria-label="Text workbook name"
            value={name}
            maxLength={150}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Extraction mode
          <select
            aria-label="Text extraction mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as TextMode)}
          >
            <option value="delimited">Delimited records</option>
            <option value="keyvalue">Key: value records</option>
            <option value="lines">Keep each source line</option>
          </select>
        </label>
        {mode === "delimited" && (
          <>
            <label>
              Delimiter
              <select
                aria-label="Text delimiter"
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
              >
                {[
                  [",", "Comma"],
                  ["\t", "Tab"],
                  [";", "Semicolon"],
                  ["|", "Pipe"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
              />{" "}
              First record contains headers
            </label>
          </>
        )}
      </div>
      <label className="source-text">
        Source text
        <textarea
          aria-label="Source text to structure"
          value={text}
          maxLength={100000}
          rows={8}
          placeholder={
            mode === "keyvalue"
              ? "Name: Example\nCity: Mumbai\n\nName: Another\nCity: Delhi"
              : "Paste records here, or load a UTF-8 text file"
          }
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <label className="secondary file-button">
        Load text file
        <input
          aria-label="Load unstructured text file"
          type="file"
          accept=".txt,.log,.tsv,.csv,.pdf,.docx"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (/\.(pdf|docx)$/i.test(f.name)) {
              if (f.size > 5 * 1024 * 1024) {
                setError("Maximum document size is 5 MB");
                return;
              }
              setBusy(true);
              setError("");
              const body = new FormData();
              body.append("file", f);
              try {
                const result = await request<{ text: string }>(
                  "/workbooks/extract-text",
                  { method: "POST", body },
                );
                setText(result.text);
                setMode("lines");
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
              e.target.value = "";
              return;
            }
            if (f.size > 100000) {
              setError("Maximum source text size is 100 KB");
              return;
            }
            setText(await f.text());
            setError("");
            e.target.value = "";
          }}
        />
      </label>
      <p className="small-note">
        Key/value mode uses blank lines or repeated keys to separate records.
        Free prose stays as source lines. No AI inference, financial updates or
        OCR. Up to 1000 records.
      </p>
      {text && preview.error && (
        <p role="status" className="alert warning">
          {preview.error}
        </p>
      )}
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {!!preview.rows.length && (
        <>
          <h3>
            Review {preview.rows.length - 1} records · {preview.rows[0]?.length}{" "}
            columns
          </h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {preview.rows[0]?.map((c, i) => (
                    <th key={i}>{c || `Column ${i + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(1, 6).map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small-note">
            First five records shown. Check headings and boundaries before
            continuing.
          </p>
        </>
      )}
      <button
        className="primary"
        disabled={busy || !!preview.error || !name.trim()}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const w = await request<{ id: string }>("/workbooks/from-text", {
              method: "POST",
              body: JSON.stringify({ name, text, mode, delimiter, hasHeader }),
            });
            onCreated(w.id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving reviewed worksheet…" : "Save reviewed worksheet"}
      </button>
    </section>
  );
}
