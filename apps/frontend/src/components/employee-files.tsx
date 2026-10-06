"use client";
import { useEffect, useState } from "react";
import { Download, Paperclip, Trash2 } from "lucide-react";
import { download, fileBlob, request } from "../lib/client";
export type EmployeeAttachment = {
  id: string;
  filename: string;
  size: number;
  mime: string;
};
export function EmployeePhoto({
  id,
  name,
}: {
  id?: string | null;
  name: string;
}) {
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true,
      url = "";
    fileBlob(`/files/${id}`)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImage({ id, url });
      })
      .catch(() => {
        /* Initials remain available when a photo cannot load. */
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (image && image.id === id)
    // Photos use authenticated blob URLs and cannot use Next's remote optimiser.
    return (
      <img
        className="employee-photo"
        src={image.url}
        alt={`${name}'s profile photo`}
      />
    );
  return (
    <>
      {name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")}
    </>
  );
}
export function AttachmentLink({
  file,
  own,
  onRemoved,
}: {
  file: EmployeeAttachment;
  own: boolean;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(remove = false) {
    setBusy(true);
    setError("");
    try {
      if (remove) {
        await request(`/files/${file.id}`, { method: "DELETE" });
        onRemoved();
      } else await download(`/files/${file.id}`, file.filename);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="message-attachment">
      <Paperclip size={15} />
      <button
        type="button"
        className="text-button"
        onClick={() => void run()}
        disabled={busy}
      >
        <Download size={14} /> {file.filename}{" "}
        <small>{Math.ceil(file.size / 1024)} KB</small>
      </button>
      {own && (
        <button
          type="button"
          className="icon-button"
          aria-label={`Remove attachment ${file.filename}`}
          disabled={busy}
          onClick={() => void run(true)}
        >
          <Trash2 size={14} />
        </button>
      )}
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
