"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, X, CheckCheck, VolumeX, MessageSquare } from "lucide-react";
import { request, date } from "../lib/client";
type Item = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  href: string;
  kind: string;
};
export function NotificationInbox({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<Item[]>([]),
    [read, setRead] = useState<string[]>([]),
    [muted, setMuted] = useState(false),
    [error, setError] = useState("");
  const key = `elms.inbox.${employeeId}`;
  const load = useCallback(
    () =>
      request<Item[]>("/inbox")
        .then((v) => {
          setItems(v);
          setError("");
        })
        .catch(() =>
          setError(
            "Updates could not load. Retry when your connection returns.",
          ),
        ),
    [],
  );
  useEffect(() => {
    const stored = () => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "{}");
        setRead(
          Array.isArray(value.read)
            ? value.read
                .filter((v: unknown) => typeof v === "string")
                .slice(-200)
            : [],
        );
        setMuted(value.muted === true);
      } catch {
        setRead([]);
      }
    };
    const id = requestAnimationFrame(stored);
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => {
      cancelAnimationFrame(id);
      clearInterval(timer);
    };
  }, [key, load]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  function persist(ids: string[], mute = muted) {
    const bounded = ids.slice(-200);
    setRead(bounded);
    setMuted(mute);
    try {
      localStorage.setItem(key, JSON.stringify({ read: bounded, muted: mute }));
    } catch {
      /* Device storage may be unavailable; keep this session usable. */
    }
  }
  const unread = items.filter((i) => !read.includes(i.id));
  return (
    <div className="notification-inbox">
      <button
        className="icon-button inbox-trigger"
        aria-label="Open notification centre"
        aria-expanded={open}
        aria-controls="employee-inbox"
        onClick={() => setOpen(!open)}
      >
        <Bell size={19} />
        {!muted && unread.length > 0 && (
          <span className="inbox-count">{Math.min(unread.length, 99)}</span>
        )}
      </button>
      {open && (
        <section
          id="employee-inbox"
          className="inbox-panel"
          aria-label="Employee notification centre"
        >
          <div className="inbox-heading">
            <div>
              <h2>Your updates</h2>
              <p>{unread.length} unread · last seven days</p>
            </div>
            <button
              className="icon-button"
              aria-label="Close notification centre"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="inbox-actions">
            <button
              className="text-button"
              onClick={() => persist(items.map((i) => i.id))}
            >
              <CheckCheck size={15} />
              Mark all read
            </button>
            <button
              className="text-button"
              aria-pressed={muted}
              onClick={() => persist(read, !muted)}
            >
              <VolumeX size={15} />
              {muted ? "Show badge" : "Mute badge"}
            </button>
          </div>
          {error ? (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => void load()}>Retry</button>
            </div>
          ) : !items.length ? (
            <div className="empty compact">
              <Bell size={26} />
              <h3>You’re all caught up</h3>
              <p>Team messages and assigned tasks appear here.</p>
            </div>
          ) : (
            <div className="inbox-items">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={read.includes(item.id) ? "read" : "unread"}
                  onClick={() => {
                    persist([...read, item.id]);
                    setOpen(false);
                  }}
                >
                  <span>
                    {item.kind === "task" ? "Assigned work" : "Team update"}
                  </span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <small>{date(item.createdAt)}</small>
                </Link>
              ))}
            </div>
          )}
          <div className="inbox-footer">
            <Link href="/team" onClick={() => setOpen(false)}>
              <MessageSquare size={15} />
              Send a team update
            </Link>
            <small>
              Read state and badge preference are stored on this device.
            </small>
          </div>
        </section>
      )}
    </div>
  );
}
