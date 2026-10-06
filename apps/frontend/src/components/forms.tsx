"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { request, type Row, read } from "../lib/client";

export type Option = { value: string; label: string };
export interface Field {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "password"
    | "email"
    | "datetime-local"
    | "select"
    | "textarea"
    | "checkbox"
    | "lines";
  options?: Option[];
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
  receipt?: boolean;
}
export interface FormSpec {
  title: string;
  description?: string;
  endpoint: string;
  method?: string;
  fields: Field[];
  initial?: Row;
  submitLabel?: string;
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose} aria-label={title}>
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Lines({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const rows = Array.isArray(value) ? (value as Row[]) : [];
  const change = (index: number, key: string, next: unknown) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, [key]: next } : r)));
  return (
    <div className="line-editor">
      {rows.map((r, i) => (
        <div className="line-row" key={i}>
          <label>
            Item
            <select
              required
              value={String(r.itemId ?? "")}
              onChange={(e) => change(i, "itemId", e.target.value)}
              disabled={field.receipt}
            >
              <option value="">Select item</option>
              {field.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {field.receipt ? "Usable received" : "Quantity"}
            <input
              type="number"
              required
              min={field.receipt ? 0 : 1}
              max={1000000}
              value={Number(r.quantity ?? 1)}
              onChange={(e) => change(i, "quantity", Number(e.target.value))}
            />
          </label>
          {field.receipt && (
            <label>
              Damaged
              <input
                type="number"
                min={0}
                value={Number(r.damaged ?? 0)}
                onChange={(e) => change(i, "damaged", Number(e.target.value))}
              />
            </label>
          )}
          {!field.receipt && (
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove item ${i + 1}`}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      ))}
      {!field.receipt && (
        <button
          type="button"
          className="secondary small"
          onClick={() => onChange([...rows, { itemId: "", quantity: 1 }])}
        >
          <Plus size={15} />
          Add item
        </button>
      )}
    </div>
  );
}
export function FormDialog({
  spec,
  onClose,
  onSaved,
}: {
  spec: FormSpec;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<Row>(() => spec.initial ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (name: string, value: unknown) =>
    setData((v) => ({ ...v, [name]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = { ...data };
      for (const f of spec.fields) {
        if (f.type === "number")
          payload[f.name] = Number(payload[f.name] ?? f.min ?? 0);
        if (f.type === "checkbox") payload[f.name] = !!payload[f.name];
        if (f.type === "datetime-local" && payload[f.name])
          payload[f.name] = new Date(String(payload[f.name])).toISOString();
        if (
          f.type === "lines" &&
          (!Array.isArray(payload[f.name]) ||
            !(payload[f.name] as unknown[]).length)
        )
          throw new Error("Add at least one item");
        if (!f.required && payload[f.name] === "") delete payload[f.name];
      }
      await request(spec.endpoint, {
        method: spec.method ?? "POST",
        body: JSON.stringify(payload),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={spec.title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit} className="modal-body">
        {spec.description && <p className="muted">{spec.description}</p>}
        <div className="form-grid">
          {spec.fields.map((f) => {
            const props = {
              name: f.name,
              "aria-label": f.label,
              required: f.required ?? false,
              value: String(data[f.name] ?? ""),
              onChange: (
                e: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                >,
              ) => update(f.name, e.target.value),
            };
            return (
              <div
                key={f.name}
                className={
                  f.type === "lines" || f.type === "textarea" ? "span-all" : ""
                }
              >
                {f.type === "lines" ? (
                  <>
                    <p className="field-label">{f.label}</p>
                    <Lines
                      field={f}
                      value={data[f.name]}
                      onChange={(v) => update(f.name, v)}
                    />
                  </>
                ) : (
                  <label>
                    {f.label}
                    {f.type === "select" ? (
                      <select {...props}>
                        <option value="">Choose…</option>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea {...props} rows={3} />
                    ) : f.type === "checkbox" ? (
                      <input
                        type="checkbox"
                        checked={!!data[f.name]}
                        onChange={(e) => update(f.name, e.target.checked)}
                      />
                    ) : (
                      <input
                        {...props}
                        type={f.type ?? "text"}
                        min={f.min}
                        max={f.max}
                        step={
                          f.type === "number" &&
                          ["unitCost", "weightKg"].includes(f.name)
                            ? ".01"
                            : 1
                        }
                        maxLength={f.type === "password" ? 128 : 500}
                      />
                    )}
                    {f.hint && <small className="muted">{f.hint}</small>}
                  </label>
                )}
              </div>
            );
          })}
        </div>
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : (spec.submitLabel ?? "Save changes")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export const options = (rows: Row[] = [], field = "name"): Option[] =>
  rows.map((r) => ({
    value: String(r.id ?? r.code),
    label: String(read(r, field) ?? r.id),
  }));
