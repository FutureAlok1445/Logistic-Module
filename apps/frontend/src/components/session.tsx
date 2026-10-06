"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  request,
  restoreSession,
  setToken,
  type Employee,
} from "../lib/client";
const permissions: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  LOGISTICS_MANAGER: [
    "students:read",
    "payments:read",
    "dispatch:read",
    "dispatch:write",
    "dispatch:approve",
    "transfers:read",
    "transfers:write",
    "transfers:approve",
    "inventory:read",
    "inventory:write",
    "couriers:read",
    "couriers:write",
    "reports:read",
    "reports:export",
    "notifications:read",
    "notifications:templates:write",
    "b2b:read",
    "b2b:write",
    "print:read",
    "print:write",
    "import:write",
    "config:read",
    "config:write",
    "audit:read",
  ],
  DISPATCH_EXECUTIVE: [
    "students:read",
    "payments:read",
    "dispatch:read",
    "dispatch:write",
    "inventory:read",
    "couriers:read",
    "config:read",
    "transfers:read",
    "notifications:read",
    "import:write",
    "reports:read",
  ],
  WAREHOUSE_STAFF: ["inventory:read", "inventory:write"],
  VIEWER_AUDITOR: ["*.read", "reports:export"],
};
const Context = createContext<{
  user: Employee | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  has: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
}>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  has: () => false,
  refreshUser: async () => {},
});
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const selected = localStorage.getItem("elms-theme") ?? "system";
      document.documentElement.dataset.theme =
        selected === "system" ? (media.matches ? "dark" : "light") : selected;
    };
    apply();
    media.addEventListener("change", apply);
    let live = true;
    restoreSession()
      .then((r) => {
        if (live) setUser(r.user);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoading(false);
      });
    const expire = () => setUser(null);
    window.addEventListener("elms:expired", expire);
    return () => {
      live = false;
      window.removeEventListener("elms:expired", expire);
      media.removeEventListener("change", apply);
    };
  }, []);
  const login = async (email: string, password: string) => {
    const r = await request<{ user: Employee; accessToken: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
    setToken(r.accessToken);
    setUser(r.user);
  };
  const logout = async () => {
    await request("/auth/logout", { method: "POST" });
    setToken(null);
    setUser(null);
  };
  const refreshUser = async () => {
    setUser(await request<Employee>("/auth/me"));
  };
  const has = useCallback(
    (p: string) => {
      const list = permissions[user?.role ?? ""] ?? [];
      return (
        list.includes("*") ||
        list.includes(p) ||
        (p.endsWith(":read") && list.includes("*.read"))
      );
    },
    [user?.role],
  );
  return (
    <Context.Provider
      value={{ user, loading, login, logout, has, refreshUser }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
