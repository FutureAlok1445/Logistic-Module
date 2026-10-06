import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { protect } from "../../http";
import { hasPermission } from "../../shared/constants/permissions";
import { AppError } from "../../shared/errors";
import { querySchema, listResource, dashboard, forecast } from "./queries";
import { audit, transaction } from "./transaction";
import { prisma } from "../../config/database";
import { range } from "./queries";
import { resources } from "./router";

function flatten(
  value: unknown,
  prefix = "",
  out: Record<string, string> = {},
) {
  if (!value || typeof value !== "object" || value instanceof Date) {
    out[prefix] =
      value instanceof Date ? value.toISOString() : String(value ?? "");
    return out;
  }
  for (const [key, v] of Object.entries(value)) {
    if (
      [
        "passwordHash",
        "token",
        "before",
        "after",
        "packedItems",
        "trackingHistory",
        "email",
        "mobile",
        "address",
        "notes",
      ].includes(key)
    )
      continue;
    const name = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(v)) out[name] = JSON.stringify(v);
    else if (typeof v === "object" && v !== null && !("toFixed" in v))
      flatten(v, name, out);
    else out[name] = String(v ?? "");
  }
  return out;
}
export const safeCell = (value: string) =>
  /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
export async function pdfReport(title: string, rows: Record<string, string>[]) {
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (b) => chunks.push(b));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.fontSize(18).text(title);
  doc
    .fontSize(9)
    .text(`Generated ${new Date().toISOString()} | ${rows.length} rows`);
  doc.moveDown();
  for (let i = 0; i < rows.length; i++) {
    if (doc.y > 490) doc.addPage();
    doc.fontSize(9).text(
      `${i + 1}. ${Object.entries(rows[i])
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ")}`,
      { width: 765 },
    );
    doc.moveDown(0.5);
  }
  if (!rows.length) doc.text("No records match this report.");
  doc.end();
  return done;
}
const reportMap: Record<string, string> = {
  ...Object.fromEntries(Object.keys(resources).map((r) => [r, r])),
  dispatch: "dispatches",
  pending: "dispatches",
  delivery: "dispatches",
  transfer: "transfers",
  inventory: "inventory",
  print: "requisitions",
  audit: "audit",
  cost: "dispatches",
  monthly: "dispatches",
  yearly: "dispatches",
};
export async function reportRoutes(app: FastifyInstance) {
  app.get(
    "/:report",
    { preHandler: protect(app, "reports:read") },
    async (req, reply) => {
      const { report } = z.object({ report: z.string() }).parse(req.params);
      if (
        report === "labels"
          ? !hasPermission(req.employee.role, "dispatch:write")
          : !hasPermission(req.employee.role, "reports:export")
      )
        throw new AppError(
          403,
          "FORBIDDEN",
          "Your role cannot export this report",
        );
      const format = z
        .object({ format: z.enum(["csv", "xlsx", "pdf"]).default("csv") })
        .parse(req.query).format;
      const q = querySchema.parse(req.query);
      let rows: Record<string, string>[];
      if (report === "courier")
        rows = (await dashboard(q)).courierPerformance.map((r) => flatten(r));
      else if (report === "forecast")
        rows = (await forecast(q.centerId)).map((r) => flatten(r));
      else if (["monthly", "yearly", "cost"].includes(report)) {
        const dates = range(q);
        const periodFormat = report === "yearly" ? "YYYY" : "YYYY-MM";
        const periodDate =
          report === "cost"
            ? Prisma.sql`d."dispatchedAt"`
            : Prisma.sql`d."createdAt"`;
        const result = await prisma.$queryRaw<
          Record<string, unknown>[]
        >`SELECT to_char(${periodDate} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', ${periodFormat}) AS period, count(*) AS shipments, count(*) FILTER (WHERE d.status='DELIVERED') AS delivered, count(*) FILTER (WHERE d.status='FAILED_DELIVERY') AS failed, COALESCE(sum(d."materialCost") FILTER (WHERE d."dispatchedAt" IS NOT NULL), 0) AS material_cost_inr FROM "Dispatch" d JOIN "Student" s ON s.id=d."studentId" WHERE (${report !== "cost"} OR d."dispatchedAt" IS NOT NULL) AND (${q.courseId ?? null}::text IS NULL OR s."courseId"=${q.courseId ?? null}) AND (${q.centerId ?? null}::text IS NULL OR s."centerId"=${q.centerId ?? null}) AND (${q.courierPartnerId ?? null}::text IS NULL OR d."courierPartnerId"=${q.courierPartnerId ?? null}) AND (${dates?.gte ?? null}::timestamp IS NULL OR ${periodDate}>=${dates?.gte ?? null}) AND (${dates?.lt ?? null}::timestamp IS NULL OR ${periodDate}<${dates?.lt ?? null}) GROUP BY 1 ORDER BY 1`;
        rows = result.map((r) =>
          Object.fromEntries(
            Object.entries(r).map(([key, value]) => [key, String(value)]),
          ),
        );
      } else if (report === "labels") {
        if (
          !["SUPER_ADMIN", "LOGISTICS_MANAGER", "DISPATCH_EXECUTIVE"].includes(
            req.employee.role,
          )
        )
          throw new AppError(
            403,
            "PII_EXPORT_RESTRICTED",
            "Shipping labels are restricted",
          );
        const result = await listResource("dispatches", q, true);
        if (result.truncated)
          throw new AppError(
            422,
            "EXPORT_TOO_LARGE",
            "Narrow filters to 10000 rows or fewer",
          );
        rows = result.rows.map((r) => {
          const d = r as {
            id: string;
            awbNumber: string | null;
            addressSnapshot?: Record<string, string>;
            kit: { name: string };
            student: {
              name: string;
              address: string;
              city: string;
              state: string;
              pincode: string;
              mobile: string;
            };
          };
          return {
            shipment: d.id,
            kit: d.kit.name,
            awb: d.awbNumber ?? "",
            ...(d.addressSnapshot ?? {
              name: d.student.name,
              address: d.student.address,
              city: d.student.city,
              state: d.student.state,
              pincode: d.student.pincode,
              mobile: d.student.mobile,
            }),
          };
        });
      } else {
        const resource = reportMap[report];
        if (!resource)
          throw new AppError(404, "REPORT_NOT_FOUND", "Unknown report");
        if (!hasPermission(req.employee.role, resources[resource]))
          throw new AppError(
            403,
            "FORBIDDEN",
            "Your role cannot export this module",
          );
        if (report === "pending") q.status = "QUEUED";
        if (report === "delivery") q.status = "DELIVERED";
        const result = await listResource(resource, q, true);
        if (result.truncated)
          throw new AppError(
            422,
            "EXPORT_TOO_LARGE",
            "Narrow filters to 10000 rows or fewer",
          );
        rows = result.rows.map((r) => flatten(r));
      }
      await transaction((tx) =>
        audit(tx, req.employee.id, "REPORT_EXPORTED", "Report", report, {
          rows: rows.length,
          format,
        }),
      );
      reply.header(
        "Content-Disposition",
        `attachment; filename="elms-${report}.${format}"`,
      );
      reply.header("Cache-Control", "no-store");
      if (format === "pdf")
        return reply
          .type("application/pdf")
          .send(await pdfReport(`ELMS ${report} report`, rows));
      const sheet = XLSX.utils.json_to_sheet(
        rows.map((r) =>
          Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k, safeCell(v)]),
          ),
        ),
      );
      if (format === "csv")
        return reply
          .type("text/csv; charset=utf-8")
          .send("\uFEFF" + XLSX.utils.sheet_to_csv(sheet));
      const workbook = XLSX.utils.book_new();
      const headers = rows.length ? Object.keys(rows[0]) : [];
      sheet["!cols"] = headers.map((k) => ({
        wch: Math.min(
          45,
          Math.max(
            14,
            k.length + 2,
            ...rows.slice(0, 100).map((r) => (r[k] ?? "").length + 2),
          ),
        ),
      }));
      if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };
      XLSX.utils.book_append_sheet(workbook, sheet, "Report");
      return reply
        .type(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .send(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
    },
  );
}
