export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
}
let accessToken: string | null = null;
let refreshing: Promise<{ user: Employee; accessToken: string }> | null = null;
export const setToken = (token: string | null) => {
  accessToken = token;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function restoreSession(): Promise<{
  user: Employee;
  accessToken: string;
}> {
  if (!refreshing)
    refreshing = fetch("/api/v1/auth/refresh", {
      method: "POST",
      body: "{}",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new ApiError(body.message, r.status);
        setToken(body.data.accessToken);
        return body.data;
      })
      .finally(() => {
        refreshing = null;
      });
  return refreshing;
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new ApiError(
      "Unable to connect. Check your connection and retry.",
      0,
    );
  }
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    try {
      await restoreSession();
      return request<T>(path, options, false);
    } catch {
      setToken(null);
      window.dispatchEvent(new Event("elms:expired"));
      throw new ApiError("Session expired. Sign in again.", 401);
    }
  }
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(body.message ?? "Operation failed", response.status);
  return body.data as T;
}
export const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
export async function fileBlob(
  path: string,
  options: RequestInit = {},
): Promise<Blob> {
  const fetchFile = () => {
    const headers = new Headers(options.headers);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    if (options.body) headers.set("Content-Type", "application/json");
    return fetch(`/api/v1${path}`, {
      ...options,
      credentials: "same-origin",
      headers,
      cache: "no-store",
    });
  };
  let response = await fetchFile();
  if (response.status === 401) {
    await restoreSession();
    response = await fetchFile();
  }
  if (!response.ok) {
    const b = await response.json();
    throw new ApiError(b.message, response.status);
  }
  return response.blob();
}
export async function download(
  path: string,
  filename: string,
  options: RequestInit = {},
) {
  const url = URL.createObjectURL(await fileBlob(path, options));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export type Row = Record<string, unknown>;
export const read = (row: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (v, k) => (v && typeof v === "object" ? (v as Row)[k] : undefined),
      row,
    );
export const label = (v: unknown) =>
  String(v ?? "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
export const currency = (v: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(v ?? 0));
export const date = (v: unknown) =>
  v
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(String(v)))
    : "—";
