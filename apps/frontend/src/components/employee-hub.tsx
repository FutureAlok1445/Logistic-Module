"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  UserRound,
  Circle,
  ClipboardList,
  Plus,
  Check,
  MapPin,
  Mail,
  Building2,
  Clock,
  Paperclip,
  X,
} from "lucide-react";
import { request, post, date, label } from "../lib/client";
import { useSession } from "./session";
import {
  EmployeePhoto,
  AttachmentLink,
  type EmployeeAttachment,
} from "./employee-files";
type Profile = {
  jobTitle: string;
  department: string;
  location: string;
  phone: string;
  bio: string;
  availability: string;
  statusMessage: string;
  lastSeenAt: string;
  avatarFileId?: string | null;
};
type Member = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  profile: Profile | null;
};
type Message = {
  id: string;
  body: string;
  senderId: string;
  sender: { fullName: string };
  createdAt: string;
  attachments?: EmployeeAttachment[];
};
type Task = {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueAt: string | null;
  reference: string;
  assigneeId: string;
  assignee: { fullName: string };
  creator: { fullName: string };
};
const defaults: Profile = {
  jobTitle: "",
  department: "Logistics",
  location: "",
  phone: "",
  bio: "",
  availability: "AVAILABLE",
  statusMessage: "",
  lastSeenAt: "",
};
const initials = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
function presence(member: Member) {
  if (member.profile?.availability === "OFFLINE") return "OFFLINE";
  return member.profile &&
    Date.now() - new Date(member.profile.lastSeenAt).getTime() < 180000
    ? member.profile.availability
    : "OFFLINE";
}
export function ProfileView() {
  const { refreshUser } = useSession();
  const [member, setMember] = useState<Member | null>(null),
    [profile, setProfile] = useState<Profile>(defaults),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    request<Member>("/profile")
      .then((m) => {
        setMember(m);
        setName(m.fullName);
        setProfile({ ...defaults, ...m.profile });
      })
      .catch((e) => setError(e.message));
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const m = await request<Member>("/profile", {
        method: "PUT",
        body: JSON.stringify({ ...profile, fullName: name }),
      });
      setMember(m);
      await refreshUser();
      setNotice("Profile and availability saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function photo(file?: File) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const f = await request<EmployeeAttachment>("/profile/photo", {
          method: "POST",
          body: form,
        });
        setProfile((p) => ({ ...p, avatarFileId: f.id }));
        setNotice("Profile photo updated.");
      } else {
        await request("/profile/photo", { method: "DELETE" });
        setProfile((p) => ({ ...p, avatarFileId: null }));
        setNotice("Profile photo removed.");
      }
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
          <h1>My employee profile</h1>
          <p>Help colleagues know your role, work location and availability.</p>
        </div>
        <Link href="/team" className="secondary">
          <MessageSquare size={16} />
          Open team hub
        </Link>
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
      <div className="profile-layout">
        <aside className="profile-summary">
          <div className="profile-avatar">
            <EmployeePhoto
              id={profile.avatarFileId}
              name={name || "Employee"}
            />
          </div>
          <div className="profile-photo-tools">
            <label className="secondary">
              Upload photo
              <input
                aria-label="Upload profile photo"
                type="file"
                accept="image/png,image/jpeg"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void photo(f);
                }}
              />
            </label>
            {profile.avatarFileId && (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => void photo()}
              >
                Remove photo
              </button>
            )}
            <small>PNG or JPEG · up to 512 KB</small>
          </div>
          <h2>{name || "Your profile"}</h2>
          <p>{profile.jobTitle || label(member?.role)}</p>
          <span className={`presence ${profile.availability.toLowerCase()}`}>
            <Circle size={9} />
            {label(profile.availability)}
          </span>
          <div className="profile-meta">
            <p>
              <Mail size={16} />
              {member?.email}
            </p>
            <p>
              <Building2 size={16} />
              {profile.department}
            </p>
            <p>
              <MapPin size={16} />
              {profile.location || "Work location not set"}
            </p>
          </div>
          <p className="small-note">
            Availability is manually selected. Recent activity updates while
            ELMS is open; this is not attendance tracking.
          </p>
          <Link href="/settings" className="text-button">
            Password & device sessions
          </Link>
        </aside>
        <form className="panel padded profile-form" onSubmit={save}>
          <h2>Profile details</h2>
          <div className="form-grid">
            <label>
              Full name
              <input
                aria-label="Profile full name"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {(
              [
                ["jobTitle", "Job title"],
                ["department", "Department"],
                ["location", "Work location"],
                ["phone", "Work phone"],
              ] as const
            ).map(([key, text]) => (
              <label key={key}>
                {text}
                <input
                  maxLength={key === "phone" ? 30 : 100}
                  value={profile[key]}
                  onChange={(e) =>
                    setProfile({ ...profile, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <label>
              Availability
              <select
                aria-label="Availability"
                value={profile.availability}
                onChange={(e) =>
                  setProfile({ ...profile, availability: e.target.value })
                }
              >
                {["AVAILABLE", "BUSY", "AWAY", "OFFLINE"].map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="span-all">
              Status message
              <input
                placeholder="For example: Packing run until 3 pm; urgent queries on team hub"
                maxLength={160}
                value={profile.statusMessage}
                onChange={(e) =>
                  setProfile({ ...profile, statusMessage: e.target.value })
                }
              />
            </label>
            <label className="span-all">
              About your work
              <textarea
                rows={4}
                maxLength={500}
                value={profile.bio}
                onChange={(e) =>
                  setProfile({ ...profile, bio: e.target.value })
                }
              />
            </label>
          </div>
          <div className="form-footer">
            <button className="primary" disabled={busy}>
              <Check size={16} />
              {busy ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
export function TeamHub() {
  const { user } = useSession(),
    manager = ["SUPER_ADMIN", "LOGISTICS_MANAGER"].includes(user?.role ?? "");
  const [members, setMembers] = useState<Member[]>([]),
    [messages, setMessages] = useState<Message[]>([]),
    [tasks, setTasks] = useState<Task[]>([]),
    [channel, setChannel] = useState("operations"),
    [recipient, setRecipient] = useState(""),
    [text, setText] = useState(""),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("messages"),
    [taskForm, setTaskForm] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null),
    [messageSearch, setMessageSearch] = useState("");
  const query = recipient
    ? `recipientId=${encodeURIComponent(recipient)}`
    : `channel=${channel}`;
  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      request<Member[]>("/team"),
      request<Message[]>(
        `/messages?${query}&search=${encodeURIComponent(messageSearch)}`,
      ),
      request<Task[]>("/tasks"),
    ]);
    for (const [i, r] of results.entries()) {
      if (r.status === "rejected") {
        setError(r.reason.message);
        continue;
      }
      if (i === 0) setMembers(r.value as Member[]);
      else if (i === 1) setMessages(r.value as Message[]);
      else setTasks(r.value as Task[]);
    }
  }, [query, messageSearch]);
  useEffect(() => {
    const searchTimer = setTimeout(() => void load(), 250);
    const timer = setInterval(() => void load(), 15000);
    return () => {
      clearTimeout(searchTimer);
      clearInterval(timer);
    };
  }, [load]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (attachment) {
        const form = new FormData();
        form.append("body", text);
        form.append("channel", channel);
        if (recipient) form.append("recipientId", recipient);
        form.append("file", attachment);
        await request("/messages/with-file", { method: "POST", body: form });
      } else
        await post("/messages", {
          body: text,
          channel,
          recipientId: recipient || undefined,
        });
      setText("");
      setAttachment(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function createTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      due = String(form.get("dueAt") || "");
    setBusy(true);
    try {
      await post("/tasks", {
        title: form.get("title"),
        description: form.get("description"),
        priority: form.get("priority"),
        assigneeId: form.get("assigneeId"),
        dueAt: due ? new Date(due).toISOString() : undefined,
        reference: form.get("reference"),
      });
      setTaskForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>IMS team hub</h1>
          <p>
            One place for operational handovers, colleague availability and
            assigned work.
          </p>
        </div>
        <Link href="/profile" className="secondary">
          <UserRound size={16} />
          My profile
        </Link>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
          <button
            onClick={() => {
              setError("");
              void load();
            }}
          >
            Retry
          </button>
        </div>
      )}
      <div className="team-layout">
        <aside className="team-directory">
          <h2>
            Colleagues <span>{members.length}</span>
          </h2>
          <input
            aria-label="Search colleagues"
            placeholder="Find a colleague"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="channel-list">
            {["operations", "warehouse", "announcements"].map((c) => (
              <button
                key={c}
                className={!recipient && channel === c ? "active" : ""}
                onClick={() => {
                  setChannel(c);
                  setRecipient("");
                  setAttachment(null);
                  setText("");
                  setMessageSearch("");
                  setTab("messages");
                }}
              >
                <MessageSquare size={16} />
                {label(c)}
              </button>
            ))}
          </div>
          <div className="member-list">
            {members
              .filter((m) =>
                `${m.fullName} ${m.profile?.jobTitle ?? ""}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((m) => (
                <button
                  key={m.id}
                  className={recipient === m.id ? "active" : ""}
                  onClick={() => {
                    setRecipient(m.id);
                    setAttachment(null);
                    setText("");
                    setMessageSearch("");
                    setTab("messages");
                  }}
                >
                  <span className="avatar">
                    <EmployeePhoto
                      id={m.profile?.avatarFileId}
                      name={m.fullName}
                    />
                    <i className={presence(m).toLowerCase()} />
                  </span>
                  <span>
                    <strong>{m.fullName}</strong>
                    <small>{m.profile?.jobTitle || label(m.role)}</small>
                    {m.profile?.statusMessage && (
                      <small title={m.profile.statusMessage}>
                        {m.profile.statusMessage}
                      </small>
                    )}
                  </span>
                </button>
              ))}
          </div>
          <p className="small-note">
            Presence reflects selected status and recent ELMS activity.
          </p>
        </aside>
        <div className="team-content">
          <div className="workspace-tabs">
            <button
              className={tab === "messages" ? "active" : ""}
              onClick={() => setTab("messages")}
            >
              <MessageSquare size={16} />
              {recipient
                ? members.find((m) => m.id === recipient)?.fullName
                : label(channel)}
            </button>
            <button
              className={tab === "tasks" ? "active" : ""}
              onClick={() => setTab("tasks")}
            >
              <ClipboardList size={16} />
              Work board{" "}
              <span>{tasks.filter((t) => t.status !== "DONE").length}</span>
            </button>
          </div>
          {tab === "messages" ? (
            <div className="message-workspace">
              <div className="conversation-tools">
                <label>
                  Search this conversation
                  <input
                    aria-label="Search conversation"
                    type="search"
                    value={messageSearch}
                    maxLength={100}
                    placeholder="Find a handover or update"
                    onChange={(e) => setMessageSearch(e.target.value)}
                  />
                </label>
                <span>Up to 100 matching messages</span>
              </div>
              <div className="message-thread" aria-live="polite">
                {messages.length ? (
                  messages.map((m) => (
                    <article
                      key={m.id}
                      className={`message ${m.senderId === user?.id ? "mine" : ""}`}
                    >
                      <span className="avatar">
                        {initials(m.sender.fullName)}
                      </span>
                      <div>
                        <div>
                          <strong>{m.sender.fullName}</strong>
                          <time>{date(m.createdAt)}</time>
                        </div>
                        <p>{m.body}</p>
                        {m.attachments?.map((f) => (
                          <AttachmentLink
                            key={f.id}
                            file={f}
                            own={m.senderId === user?.id}
                            onRemoved={() => void load()}
                          />
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty">
                    <MessageSquare size={32} />
                    <h2>
                      {recipient
                        ? messageSearch
                          ? "No matching messages"
                          : "Start a direct conversation"
                        : "No updates in this channel"}
                    </h2>
                    <p>
                      Share a handover, stock issue or coordination update.
                      Messages stay inside ELMS.
                    </p>
                  </div>
                )}
              </div>
              <form className="message-compose" onSubmit={send}>
                <label htmlFor="team-message">
                  {recipient ? "Direct message" : "Channel update"}
                </label>
                <textarea
                  id="team-message"
                  placeholder="Write an operational update…"
                  maxLength={2000}
                  required={!attachment}
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={
                    !recipient && channel === "announcements" && !manager
                  }
                />
                <div className="compose-attachments">
                  <label className="secondary">
                    <Paperclip size={15} />
                    Attach file
                    <input
                      aria-label="Attach message file"
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf,.txt,.csv,.xlsx,.docx"
                      disabled={
                        busy ||
                        (!recipient && channel === "announcements" && !manager)
                      }
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f && f.size > 2 * 1024 * 1024) {
                          setError("Attachment must be at most 2 MB");
                          return;
                        }
                        setAttachment(f ?? null);
                      }}
                    />
                  </label>
                  {attachment && (
                    <span>
                      {attachment.name}
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Clear attachment"
                        onClick={() => setAttachment(null)}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  <small>
                    One file · up to 2 MB · 10 MB storage per employee
                  </small>
                </div>
                <div>
                  <p>
                    Do not post student addresses, payment credentials or
                    provider secrets.
                  </p>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      (!text.trim() && !attachment) ||
                      (!recipient && channel === "announcements" && !manager)
                    }
                  >
                    <Send size={15} />
                    {busy ? "Sending…" : "Send message"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="work-board">
              <div className="panel-heading">
                <div>
                  <h2>{manager ? "Team work" : "My work"}</h2>
                  <p>
                    {manager
                      ? "Assign owners and resolve daily exceptions."
                      : "Tasks assigned to you and tasks you created."}
                  </p>
                </div>
                {user?.role !== "VIEWER_AUDITOR" && (
                  <button
                    className="primary small"
                    onClick={() => setTaskForm(!taskForm)}
                  >
                    <Plus size={15} />
                    {taskForm ? "Close form" : "Add task"}
                  </button>
                )}
              </div>
              {taskForm && (
                <form onSubmit={createTask} className="task-form form-grid">
                  <label>
                    Task title
                    <input
                      name="title"
                      required
                      minLength={3}
                      maxLength={150}
                    />
                  </label>
                  <label>
                    Assignee
                    <select name="assigneeId" defaultValue={user?.id}>
                      {members
                        .filter((m) => manager || m.id === user?.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Priority
                    <select name="priority">
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </label>
                  <label>
                    Due date and time
                    <input name="dueAt" type="datetime-local" />
                  </label>
                  <label>
                    Operational reference
                    <input
                      name="reference"
                      maxLength={100}
                      placeholder="Shipment or order ID"
                    />
                  </label>
                  <label>
                    Description
                    <textarea name="description" maxLength={2000} />
                  </label>
                  <button className="primary" disabled={busy}>
                    Create task
                  </button>
                </form>
              )}
              <div className="task-columns">
                {["TODO", "IN_PROGRESS", "DONE"].map((status) => (
                  <section key={status}>
                    <h3>
                      {label(status)}
                      <span>
                        {tasks.filter((t) => t.status === status).length}
                      </span>
                    </h3>
                    {tasks
                      .filter((t) => t.status === status)
                      .map((t) => (
                        <article className="task" key={t.id}>
                          <div>
                            <span
                              className={`priority ${t.priority.toLowerCase()}`}
                            >
                              {label(t.priority)}
                            </span>
                            <span>{t.assignee.fullName}</span>
                          </div>
                          <h4>{t.title}</h4>
                          <p>{t.description}</p>
                          {t.reference && <code>{t.reference}</code>}
                          {t.dueAt && (
                            <p
                              className={
                                new Date(t.dueAt) < new Date() &&
                                status !== "DONE"
                                  ? "overdue"
                                  : ""
                              }
                            >
                              <Clock size={12} />
                              {date(t.dueAt)}
                            </p>
                          )}
                          {user?.role !== "VIEWER_AUDITOR" &&
                            (manager || t.assigneeId === user?.id) && (
                              <select
                                aria-label={`Status for ${t.title}`}
                                value={status}
                                onChange={async (e) => {
                                  try {
                                    await request(`/tasks/${t.id}`, {
                                      method: "PATCH",
                                      body: JSON.stringify({
                                        status: e.target.value,
                                      }),
                                    });
                                    await load();
                                  } catch (err) {
                                    setError((err as Error).message);
                                  }
                                }}
                              >
                                {["TODO", "IN_PROGRESS", "DONE"].map((s) => (
                                  <option key={s} value={s}>
                                    {label(s)}
                                  </option>
                                ))}
                              </select>
                            )}
                        </article>
                      ))}
                    {!tasks.some((t) => t.status === status) && (
                      <p className="small-note">No tasks here.</p>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
