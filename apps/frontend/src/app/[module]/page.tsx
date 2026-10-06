import { Workspace } from "../../components/workspace";
import { notFound } from "next/navigation";
const modules = new Set([
  "dashboard",
  "login",
  "excel",
  "team",
  "profile",
  "help",
  "students",
  "dispatches",
  "transfers",
  "returns",
  "exceptions",
  "inventory",
  "packing",
  "ledger",
  "kits",
  "items",
  "orders",
  "requisitions",
  "forecast",
  "notifications",
  "imports",
  "reports",
  "audit",
  "centers",
  "courses",
  "prices",
  "couriers",
  "rules",
  "pincodes",
  "templates",
  "employees",
  "settings",
]);
export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!modules.has(module)) notFound();
  return <Workspace module={module} />;
}
