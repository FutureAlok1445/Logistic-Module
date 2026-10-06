"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  LayoutDashboard,
  Users,
  Truck,
  Boxes,
  ArrowLeftRight,
  RotateCcw,
  Building2,
  Printer,
  Bell,
  Upload,
  ChartNoAxesCombined,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  MapPin,
  Route,
  ListChecks,
  ShieldCheck,
  Layers3,
  Mail,
  FileSpreadsheet,
  MessageSquare,
  UserRound,
  Search,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
  EyeOff,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "./session";
import { Login } from "./login";
import { Dashboard } from "./dashboard";
import { ResourceView, type Lookups } from "./resource-view";
import { config } from "./resource-config";
import { request, label } from "../lib/client";
import { NotificationInbox } from "./notification-inbox";
const moduleLoading = () => (
  <div className="loading-block" role="status">
    Opening employee tools…
  </div>
);
const WorkbookStudio = dynamic(
  () => import("./workbook-studio").then((m) => m.WorkbookStudio),
  { loading: moduleLoading },
);
const WarehousePacking = dynamic(
  () => import("./warehouse-packing").then((m) => m.WarehousePacking),
  { loading: moduleLoading },
);
const ProfileView = dynamic(
  () => import("./employee-hub").then((m) => m.ProfileView),
  { loading: moduleLoading },
);
const TeamHub = dynamic(() => import("./employee-hub").then((m) => m.TeamHub), {
  loading: moduleLoading,
});
const ExceptionsView = dynamic(
  () => import("./employee-tools").then((m) => m.ExceptionsView),
  { loading: moduleLoading },
);
const HelpView = dynamic(
  () => import("./employee-tools").then((m) => m.HelpView),
  { loading: moduleLoading },
);
import {
  ImportView,
  ReportsView,
  ForecastView,
  SettingsView,
} from "./utility-views";
const nav: readonly {
  title: string;
  items: readonly (readonly [string, string, LucideIcon, string])[];
}[] = [
  {
    title: "My workspace",
    items: [
      ["excel", "IMS Excel workspace", FileSpreadsheet, "reports:read"],
      ["team", "Team hub", MessageSquare, "account:read"],
      ["profile", "My profile", UserRound, "account:read"],
      ["help", "Employee guide", CircleHelp, "account:read"],
    ],
  },
  {
    title: "Operations",
    items: [
      ["dashboard", "Overview", LayoutDashboard, "reports:read"],
      ["students", "Students", Users, "students:read"],
      ["dispatches", "Dispatch desk", Truck, "dispatch:read"],
      ["transfers", "Course transfers", ArrowLeftRight, "transfers:read"],
      ["returns", "Returns & RTO", RotateCcw, "dispatch:read"],
      ["exceptions", "Exception desk", Bell, "dispatch:read"],
    ],
  },
  {
    title: "Materials",
    items: [
      ["inventory", "Warehouse stock", Boxes, "inventory:read"],
      ["packing", "Packing station", Package, "inventory:write"],
      ["ledger", "Stock ledger", ListChecks, "inventory:read"],
      ["kits", "Kit composition", Package, "inventory:read"],
      ["items", "Material catalogue", BookOpen, "inventory:read"],
      ["orders", "Centre movements", Building2, "b2b:read"],
      ["requisitions", "Print requisitions", Printer, "print:read"],
      ["forecast", "Print demand", ChartNoAxesCombined, "print:read"],
    ],
  },
  {
    title: "Control",
    items: [
      ["notifications", "Notifications", Bell, "notifications:read"],
      ["imports", "Import files", Upload, "import:write"],
      ["reports", "Reports", ChartNoAxesCombined, "reports:read"],
      ["audit", "Audit trail", ScrollText, "audit:read"],
    ],
  },
  {
    title: "Configuration",
    items: [
      ["centers", "Centres", Building2, "config:read"],
      ["courses", "Courses", BookOpen, "config:read"],
      ["prices", "Regional prices", Layers3, "payments:read"],
      ["couriers", "Courier partners", Truck, "couriers:read"],
      ["rules", "Courier routing", Route, "couriers:read"],
      ["pincodes", "Serviceability", MapPin, "config:read"],
      ["templates", "Message templates", Mail, "notifications:read"],
      ["employees", "Employee access", ShieldCheck, "employees:read"],
      ["settings", "Settings", Settings, "account:read"],
    ],
  },
] as const;
export function Workspace({ module = "dashboard" }: { module?: string }) {
  const { user, loading, has, logout } = useSession();
  const router = useRouter();
  const [lookups, setLookups] = useState<Lookups>({
    centers: [],
    courses: [],
    items: [],
    couriers: [],
    kits: [],
  });
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        localStorage.getItem("elms.sidebar.collapsed") === "true"
      );
    } catch {
      return false;
    }
  });
  const [hiddenScrollbars, setHiddenScrollbars] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        localStorage.getItem("elms.scrollbars.hidden") === "true"
      );
    } catch {
      return false;
    }
  });
  const [error, setError] = useState("");
  const [navSearch, setNavSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!user) return;
    const ping = () => {
      void request("/presence", { method: "POST", body: "{}" }).catch(() => {});
    };
    ping();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") ping();
    }, 60000);
    return () => clearInterval(timer);
  }, [user]);
  useEffect(() => {
    if (user) {
      request<Lookups>("/lookups")
        .then(setLookups)
        .catch((e) => setError(e.message));
      if (
        user.role === "WAREHOUSE_STAFF" &&
        (module === "dashboard" || module === "login")
      )
        router.replace("/inventory");
    }
  }, [user, module, router]);
  if (loading)
    return (
      <main className="boot" role="status">
        <Package size={32} />
        <p>Opening your workspace…</p>
      </main>
    );
  if (!user) return <Login />;
  const permission =
    config[module]?.permission ??
    (
      {
        dashboard: "reports:read",
        imports: "import:write",
        reports: "reports:read",
        forecast: "print:read",
        settings: "account:read",
        profile: "account:read",
        team: "account:read",
        excel: "reports:read",
        help: "account:read",
        exceptions: "dispatch:read",
        packing: "inventory:write",
      } as Record<string, string>
    )[module];
  const allowed = permission === "account:read" || has(permission ?? "unknown");
  const title =
    config[module]?.title ??
    (
      {
        excel: "IMS Excel workspace",
        team: "Team hub",
        profile: "My profile",
      } as Record<string, string>
    )[module] ??
    label(module);
  return (
    <div
      className={`workspace ${collapsed ? "sidebar-collapsed" : ""} ${hiddenScrollbars ? "quiet-scrollbars" : ""}`}
    >
      <a className="skip-link" href="#workspace-main">
        Skip to main content
      </a>
      {open && (
        <button
          aria-label="Close navigation"
          className="nav-backdrop"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${open ? "open" : ""}`}
        id="workspace-navigation"
      >
        <Link className="brand" href="/dashboard">
          <span className="brand-symbol">
            <Package size={23} />
          </span>
          <div>
            <strong>ELMS</strong>
            <small>IMS Learning Resources</small>
          </div>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <nav aria-label="Primary navigation">
          {nav.map((group) => {
            const visible = group.items.filter(
              ([, , , p]) => p === "account:read" || has(p),
            );
            return visible.length ? (
              <div className="nav-group" key={group.title}>
                <p>{group.title}</p>
                {visible.map(([path, title, Icon]) => (
                  <Link
                    href={`/${path}`}
                    key={path}
                    className={path === module ? "active" : ""}
                    title={title}
                    aria-current={path === module ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={18} />
                    <span>{title}</span>
                  </Link>
                ))}
              </div>
            ) : null;
          })}
        </nav>
        <div className="sidebar-footer">
          <span className="live-dot" />
          Internal operations<small>India · Asia/Kolkata</small>
        </div>
      </aside>
      <div className="main-shell">
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <div className="demo-banner">
            Manager demo · use fictional data · sample workbook available in IMS
            Excel
          </div>
        )}
        <header className="topbar">
          <div>
            <button
              className="icon-button sidebar-toggle"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              aria-controls="workspace-navigation"
              onClick={() => {
                setCollapsed(!collapsed);
                try {
                  localStorage.setItem(
                    "elms.sidebar.collapsed",
                    String(!collapsed),
                  );
                } catch {
                  /* Continue with an in-memory preference. */
                }
              }}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Workspace / <strong>{title}</strong>
            </span>
          </div>
          <div className="command-search">
            <Search size={16} />
            <input
              aria-label="Find a workspace module"
              placeholder="Find a workspace…"
              value={navSearch}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => setNavSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchOpen(false);
              }}
            />
            {searchOpen && (
              <div className="command-results">
                <button
                  className="text-button"
                  onClick={() => setSearchOpen(false)}
                >
                  Close search
                </button>
                {nav
                  .flatMap((g) => g.items)
                  .filter(
                    ([, title, , p]) =>
                      (p === "account:read" || has(p)) &&
                      title.toLowerCase().includes(navSearch.toLowerCase()),
                  )
                  .slice(0, 8)
                  .map(([path, title, Icon]) => (
                    <Link
                      key={path}
                      href={`/${path}`}
                      onClick={() => {
                        setSearchOpen(false);
                        setNavSearch("");
                      }}
                    >
                      <Icon size={16} />
                      {title}
                    </Link>
                  ))}
              </div>
            )}
          </div>
          <div className="user-area">
            <button
              className="icon-button scrollbar-toggle"
              aria-label="Hide scrollbars"
              aria-pressed={hiddenScrollbars}
              title="Hide scrollbars; scrolling stays available"
              onClick={() => {
                setHiddenScrollbars(!hiddenScrollbars);
                try {
                  localStorage.setItem(
                    "elms.scrollbars.hidden",
                    String(!hiddenScrollbars),
                  );
                } catch {
                  /* Continue with an in-memory preference. */
                }
              }}
            >
              <EyeOff size={18} />
            </button>
            <NotificationInbox employeeId={user.id} />
            <Link
              className="icon-button"
              aria-label="Import and workspace help"
              href="/help"
            >
              <CircleHelp size={18} />
            </Link>
            <Link
              href="/profile"
              aria-label="Open my employee profile"
              className="profile-link"
            >
              <span className="avatar">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <strong>{user.name}</strong>
                <small>{label(user.role)}</small>
              </div>
            </Link>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await logout();
                  router.replace("/login");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main id="workspace-main" className="main-content" key={module}>
          {error && (
            <div role="alert" className="alert error">
              {error}
              <button
                onClick={() => {
                  setError("");
                  request<Lookups>("/lookups")
                    .then(setLookups)
                    .catch((e) => setError(e.message));
                }}
              >
                Retry
              </button>
            </div>
          )}
          {!permission ? (
            <div className="empty">
              <h1>Page not found</h1>
              <Link href="/dashboard">Return to overview</Link>
            </div>
          ) : !allowed ? (
            <div className="empty">
              <ShieldCheck size={36} />
              <h1>Access restricted</h1>
              <p>
                Your role cannot open this module. Contact your administrator.
              </p>
            </div>
          ) : module === "dashboard" ? (
            <Dashboard lookups={lookups} />
          ) : module === "imports" ? (
            <ImportView />
          ) : module === "reports" ? (
            <ReportsView lookups={lookups} />
          ) : module === "forecast" ? (
            <ForecastView lookups={lookups} />
          ) : module === "settings" ? (
            <SettingsView />
          ) : module === "excel" ? (
            <WorkbookStudio lookups={lookups} />
          ) : module === "profile" ? (
            <ProfileView />
          ) : module === "team" ? (
            <TeamHub />
          ) : module === "exceptions" ? (
            <ExceptionsView />
          ) : module === "help" ? (
            <HelpView />
          ) : module === "packing" ? (
            <WarehousePacking lookups={lookups} />
          ) : (
            <ResourceView key={module} resource={module} lookups={lookups} />
          )}
        </main>
        <footer className="workspace-footer">
          ELMS · Logistics operations<span>All times in Asia/Kolkata</span>
        </footer>
      </div>
    </div>
  );
}
