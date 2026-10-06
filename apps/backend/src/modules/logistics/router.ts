import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { protect, ok } from "../../http";
import { hasPermission } from "../../shared/constants/permissions";
import { hashPassword } from "../../shared/utils/crypto.utils";
import { AppError, BusinessRuleError } from "../../shared/errors";
import { paise, money, addressErrors } from "./domain";
import {
  listResource,
  querySchema,
  dashboard,
  forecast,
  dispatchWhere,
} from "./queries";
import {
  masterSchemas,
  kitSchema,
  stockSchema,
  dispatchSchema,
  transferSchema,
  approvalSchema,
  orderSchema,
  receiptSchema,
  requisitionSchema,
  employeeSchema,
} from "./schemas";
import { audit, moveStock, transaction } from "./transaction";
import { rebuildQueue, transitionDispatch } from "./dispatch.service";
import {
  requestTransfer,
  approveTransfer,
  receiveReturn,
  createCenterOrder,
  dispatchCenterOrder,
  receiveCenterOrder,
  createRequisition,
  receiveRequisition,
} from "./operations.service";

export const resources: Record<string, string> = {
  students: "students:read",
  dispatches: "dispatch:read",
  inventory: "inventory:read",
  ledger: "inventory:read",
  transfers: "transfers:read",
  returns: "dispatch:read",
  orders: "b2b:read",
  requisitions: "print:read",
  notifications: "notifications:read",
  audit: "audit:read",
  employees: "employees:read",
  kits: "inventory:read",
  items: "inventory:read",
  centers: "config:read",
  courses: "config:read",
  couriers: "couriers:read",
  rules: "couriers:read",
  pincodes: "config:read",
  templates: "notifications:read",
  prices: "payments:read",
};
const paramsId = (params: unknown) =>
  z.object({ id: z.string().min(1).max(100) }).parse(params).id;

export async function logisticsRoutes(app: FastifyInstance) {
  app.get(
    "/warehouse-packing",
    { preHandler: protect(app, "inventory:write") },
    async (req) => {
      const q = z
        .object({
          count: z.coerce.number().int().min(1).max(1000).default(100),
          search: z.string().max(100).default(""),
        })
        .parse(req.query);
      return ok(
        await prisma.dispatch.findMany({
          where: {
            status: "QUEUED",
            ...(q.search
              ? {
                  OR: [
                    { studentId: { contains: q.search } },
                    {
                      kit: {
                        name: { contains: q.search, mode: "insensitive" },
                      },
                    },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            studentId: true,
            status: true,
            kit: { select: { name: true, course: { select: { name: true } } } },
            student: { select: { center: { select: { name: true } } } },
            expectedDispatch: true,
          },
          orderBy: { createdAt: "asc" },
          take: q.count,
        }),
      );
    },
  );
  app.post(
    "/warehouse-packing",
    { preHandler: protect(app, "inventory:write") },
    async (req) => {
      const b = z
        .object({
          ids: z.array(z.string().min(1).max(100)).min(1).max(1000),
          warehouseId: z.string().min(1).max(100),
        })
        .parse(req.body);
      return ok(
        await transitionDispatch(
          req.employee.id,
          dispatchSchema.parse({ ...b, status: "PACKED" }),
          false,
        ),
      );
    },
  );
  app.get(
    "/exceptions",
    { preHandler: protect(app, "dispatch:read") },
    async () => {
      const now = new Date();
      const [failed, address, hold, late, low, shipments] = await Promise.all([
        prisma.dispatch.count({ where: { status: "FAILED_DELIVERY" } }),
        prisma.dispatch.count({ where: { status: "ADDRESS_FLAGGED" } }),
        prisma.dispatch.count({ where: { status: "HOLD" } }),
        prisma.dispatch.count({
          where: {
            expectedDelivery: { lt: now },
            status: {
              in: ["HANDED_TO_COURIER", "IN_TRANSIT", "OUT_FOR_DELIVERY"],
            },
          },
        }),
        prisma.$queryRaw<
          { id: string; name: string; quantity: number; updatedAt: Date }[]
        >`SELECT s.id,i.name,s.quantity,s."updatedAt" FROM "Stock" s JOIN "InventoryItem" i ON i.id=s."itemId" WHERE s.quantity<=i."lowStockThreshold" ORDER BY s.quantity ASC`,
        prisma.dispatch.findMany({
          where: {
            OR: [
              {
                status: { in: ["FAILED_DELIVERY", "ADDRESS_FLAGGED", "HOLD"] },
              },
              {
                expectedDelivery: { lt: now },
                status: {
                  in: ["HANDED_TO_COURIER", "IN_TRANSIT", "OUT_FOR_DELIVERY"],
                },
              },
            ],
          },
          include: { student: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
      ]);
      return ok({
        counts: { failed, address, hold, overdue: late, lowStock: low.length },
        issues: [
          ...shipments.map((d) => ({
            key: d.id,
            kind:
              d.expectedDelivery &&
              d.expectedDelivery < now &&
              ["HANDED_TO_COURIER", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(
                d.status,
              )
                ? "OVERDUE"
                : d.status,
            name: d.student.name,
            reference: d.awbNumber ?? d.id,
            updatedAt: d.updatedAt,
            href: `/dispatches?search=${encodeURIComponent(d.student.name)}&status=${d.status}`,
          })),
          ...low.slice(0, 20).map((s) => ({
            key: s.id,
            kind: "LOW_STOCK",
            name: s.name,
            reference: `${s.quantity} usable units`,
            updatedAt: s.updatedAt,
            href: `/inventory?search=${encodeURIComponent(s.name)}`,
          })),
        ],
      });
    },
  );
  app.get(
    "/dispatches/select",
    { preHandler: protect(app, "dispatch:write") },
    async (req) => {
      const q = querySchema.parse(req.query),
        count = z
          .object({
            count: z.coerce.number().int().min(1).max(1000).default(100),
          })
          .parse(req.query).count;
      const rows = await prisma.dispatch.findMany({
        where: dispatchWhere({ ...q, status: q.status || "QUEUED" }),
        select: { id: true },
        take: count,
        orderBy: { createdAt: q.sort },
      });
      return ok({ ids: rows.map((r) => r.id), count: rows.length });
    },
  );
  app.get(
    "/dashboard",
    { preHandler: protect(app, "reports:read") },
    async (req) => ok(await dashboard(querySchema.parse(req.query))),
  );
  app.get("/lookups", { preHandler: protect(app) }, async (req) => {
    const centers = await prisma.center.findMany({
      orderBy: { name: "asc" },
      take: 1000,
    });
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: "asc" },
      take: 1000,
    });
    if (req.employee.role === "WAREHOUSE_STAFF")
      return ok({ centers, items, courses: [], couriers: [], kits: [] });
    return ok({
      centers,
      items,
      courses: await prisma.course.findMany({ take: 1000 }),
      couriers: await prisma.courierPartner.findMany({ take: 1000 }),
      kits: await prisma.kit.findMany({ take: 1000 }),
    });
  });
  for (const [resource, permission] of Object.entries(resources))
    app.get(
      `/${resource}`,
      { preHandler: protect(app, permission) },
      async (req) =>
        ok(await listResource(resource, querySchema.parse(req.query))),
    );
  app.get(
    "/students/:id",
    { preHandler: protect(app, "students:read") },
    async (req) => {
      const student = await prisma.student.findUniqueOrThrow({
        where: { id: paramsId(req.params) },
        include: {
          course: { include: { kits: true } },
          center: true,
          paymentPlan: true,
          milestoneStatus: true,
          transfers: { orderBy: { requestDate: "desc" } },
          notifications: { take: 50, orderBy: { timestamp: "desc" } },
          dispatches: {
            include: {
              kit: true,
              courierPartner: true,
              trackingHistory: { orderBy: { timestamp: "asc" } },
            },
          },
        },
      });
      const [price, postcode] = await Promise.all([
        prisma.coursePrice.findUnique({
          where: {
            courseId_centerId: {
              courseId: student.courseId,
              centerId: student.centerId,
            },
          },
        }),
        prisma.pincode.findUnique({ where: { code: student.pincode } }),
      ]);
      const fee = paise(price?.fee ?? student.course.fee),
        paid = student.milestoneStatus
          .filter((m) => m.paid)
          .reduce((n, m) => n + paise(m.amount), 0),
        flags = addressErrors(student, postcode);
      return ok({
        ...student,
        financialSummary: {
          totalFee: money(fee),
          paid: money(paid),
          pending: money(Math.max(0, fee - paid)),
          excess: money(Math.max(0, paid - fee)),
          priceSource: price ? "Finance regional price" : "Finance course fee",
        },
        addressValidation: flags,
        kitEligibility: student.course.kits.map((k) => {
          const existing = student.dispatches.find(
            (d) =>
              d.kitId === k.id &&
              d.enrollmentVersion === student.enrollmentVersion,
          );
          const milestone = student.milestoneStatus.find(
            (m) => m.milestoneNumber === k.milestoneNumber,
          );
          const reasons = [
            ...(student.status !== "ACTIVE"
              ? [`Enrolment ${student.status}`]
              : []),
            ...(!milestone?.paid
              ? [`Milestone ${k.milestoneNumber} not cleared`]
              : []),
            ...(student.transfers.some((t) =>
              ["PENDING", "APPROVED_AWAITING_SYNC"].includes(t.status),
            )
              ? ["Transfer requires resolution"]
              : []),
            ...flags,
          ];
          return {
            id: k.id,
            name: k.name,
            milestone: k.milestoneNumber,
            status:
              existing?.status ?? (reasons.length ? "BLOCKED" : "ELIGIBLE"),
            reason: reasons.join("; "),
          };
        }),
      });
    },
  );
  app.get(
    "/pincodes/:id",
    { preHandler: protect(app, "dispatch:read") },
    async (req) =>
      ok(
        await prisma.pincode.findUniqueOrThrow({
          where: { code: paramsId(req.params) },
        }),
      ),
  );
  app.post(
    "/queue/reconcile",
    { preHandler: protect(app, "dispatch:write") },
    async (req) => {
      const b = z
        .object({ cursor: z.string().optional() })
        .parse(req.body ?? {});
      const students = await prisma.student.findMany({
        select: { id: true },
        take: 500,
        orderBy: { id: "asc" },
        ...(b.cursor ? { cursor: { id: b.cursor }, skip: 1 } : {}),
      });
      const result = await transaction((tx) =>
        rebuildQueue(
          tx,
          req.employee.id,
          students.map((s) => s.id),
        ),
      );
      return ok({
        ...result,
        nextCursor: students.length === 500 ? students.at(-1)?.id : null,
      });
    },
  );
  app.post(
    "/dispatches/transition",
    { preHandler: protect(app, "dispatch:write") },
    async (req) =>
      ok(
        await transitionDispatch(
          req.employee.id,
          dispatchSchema.parse(req.body),
          hasPermission(req.employee.role, "dispatch:approve"),
        ),
      ),
  );
  app.post(
    "/inventory/adjust",
    { preHandler: protect(app, "inventory:write") },
    async (req) => {
      const b = stockSchema.parse(req.body);
      return ok(
        await transaction(async (tx) => {
          await moveStock(
            tx,
            req.employee.id,
            b.itemId,
            b.centerId,
            b.quantity,
            b.reason,
          );
          await audit(
            tx,
            req.employee.id,
            "STOCK_ADJUSTED",
            "Stock",
            `${b.itemId}:${b.centerId}`,
            b,
          );
          return { adjusted: true };
        }),
      );
    },
  );
  app.post(
    "/kits",
    { preHandler: protect(app, "config:write") },
    async (req) => {
      const b = kitSchema.parse(req.body);
      return ok(
        await transaction(async (tx) => {
          const kit = await tx.kit.create({
            data: { ...b, items: { create: b.items } },
            include: { items: true },
          });
          await audit(tx, req.employee.id, "KIT_CREATED", "Kit", kit.id, b);
          return kit;
        }),
      );
    },
  );
  app.put(
    "/kits/:id",
    { preHandler: protect(app, "config:write") },
    async (req) => {
      const b = kitSchema.parse(req.body);
      const id = paramsId(req.params);
      return ok(
        await transaction(async (tx) => {
          if (
            await tx.dispatch.findFirst({
              where: { kitId: id, warehouseId: { not: null } },
            })
          )
            throw new BusinessRuleError(
              "KIT_IN_USE",
              "Create a new kit version after packing",
            );
          await tx.kitItem.deleteMany({ where: { kitId: id } });
          const kit = await tx.kit.update({
            where: { id },
            data: { ...b, items: { create: b.items } },
          });
          await audit(tx, req.employee.id, "KIT_UPDATED", "Kit", id, b);
          return kit;
        }),
      );
    },
  );
  app.post(
    "/transfers",
    { preHandler: protect(app, "transfers:write") },
    async (req) =>
      ok(
        await requestTransfer(req.employee.id, transferSchema.parse(req.body)),
      ),
  );
  app.post(
    "/transfers/:id/resolve",
    { preHandler: protect(app, "transfers:approve") },
    async (req) =>
      ok(
        await approveTransfer(
          req.employee.id,
          paramsId(req.params),
          approvalSchema.parse(req.body),
        ),
      ),
  );
  app.post(
    "/returns",
    { preHandler: protect(app, "dispatch:write") },
    async (req) => {
      const b = z
        .object({
          dispatchId: z.string(),
          reason: z.string().trim().min(5).max(500),
        })
        .parse(req.body);
      return ok(
        await transaction(async (tx) => {
          const d = await tx.dispatch.findUniqueOrThrow({
            where: { id: b.dispatchId },
          });
          if (!d.packedItems)
            throw new BusinessRuleError(
              "NOT_PACKED",
              "Return requires a packed shipment",
            );
          const r = await tx.returnRecord.create({ data: b });
          await audit(
            tx,
            req.employee.id,
            "RETURN_REQUESTED",
            "Return",
            r.id,
            b,
          );
          return r;
        }),
      );
    },
  );
  app.post(
    "/returns/:id/receive",
    { preHandler: protect(app, "dispatch:write") },
    async (req) => {
      const b = z
        .object({ condition: z.enum(["MINOR", "REPACKAGE", "UNUSABLE"]) })
        .parse(req.body);
      return ok(
        await receiveReturn(req.employee.id, paramsId(req.params), b.condition),
      );
    },
  );
  app.post("/orders", { preHandler: protect(app, "b2b:write") }, async (req) =>
    ok(await createCenterOrder(req.employee.id, orderSchema.parse(req.body))),
  );
  app.post(
    "/orders/:id/dispatch",
    { preHandler: protect(app, "b2b:write") },
    async (req) => {
      const b = z
        .object({ awbNumber: z.string().trim().min(1).max(100) })
        .parse(req.body);
      return ok(
        await dispatchCenterOrder(
          req.employee.id,
          paramsId(req.params),
          b.awbNumber,
        ),
      );
    },
  );
  app.post(
    "/orders/:id/receive",
    { preHandler: protect(app, "b2b:write") },
    async (req) =>
      ok(
        await receiveCenterOrder(
          req.employee.id,
          paramsId(req.params),
          receiptSchema.parse(req.body),
        ),
      ),
  );
  app.get(
    "/forecast",
    { preHandler: protect(app, "print:read") },
    async (req) => {
      const q = z.object({ centerId: z.string().optional() }).parse(req.query);
      return ok(await forecast(q.centerId));
    },
  );
  app.post(
    "/requisitions",
    { preHandler: protect(app, "print:write") },
    async (req) =>
      ok(
        await createRequisition(
          req.employee.id,
          requisitionSchema.parse(req.body),
        ),
      ),
  );
  app.post(
    "/requisitions/:id/receive",
    { preHandler: protect(app, "print:write") },
    async (req) =>
      ok(
        await receiveRequisition(
          req.employee.id,
          paramsId(req.params),
          receiptSchema.parse(req.body),
        ),
      ),
  );
  for (const resource of [
    "centers",
    "items",
    "couriers",
    "rules",
    "pincodes",
    "templates",
  ] as const) {
    app.post(
      `/master/${resource}`,
      {
        preHandler: protect(
          app,
          resource === "templates"
            ? "notifications:templates:write"
            : "config:write",
        ),
      },
      async (req) => {
        const b = masterSchemas[resource].parse(req.body);
        return ok(
          await transaction(async (tx) => {
            let record: { id?: string; code?: string; event?: string };
            switch (resource) {
              case "centers":
                record = await tx.center.create({
                  data: masterSchemas.centers.parse(b),
                });
                break;
              case "items":
                record = await tx.inventoryItem.create({
                  data: masterSchemas.items.parse(b),
                });
                break;
              case "couriers": {
                const c = masterSchemas.couriers.parse(b);
                record = await tx.courierPartner.create({
                  data: { ...c, trackingUrl: c.trackingUrl || null },
                });
                break;
              }
              case "rules":
                record = await tx.courierRule.create({
                  data: masterSchemas.rules.parse(b),
                });
                break;
              case "pincodes": {
                const p = masterSchemas.pincodes.parse(b);
                record = await tx.pincode.upsert({
                  where: { code: p.code },
                  create: p,
                  update: p,
                });
                break;
              }
              case "templates": {
                const t = masterSchemas.templates.parse(b);
                record = await tx.notificationTemplate.upsert({
                  where: { event: t.event },
                  create: t,
                  update: t,
                });
                break;
              }
            }
            await audit(
              tx,
              req.employee.id,
              "MASTER_SAVED",
              resource,
              record.id ?? record.code ?? record.event ?? "",
              b,
            );
            return record;
          }),
        );
      },
    );
  }
  app.put(
    "/master/:resource/:id",
    { preHandler: protect(app, "config:write") },
    async (req) => {
      const { resource, id } = z
        .object({
          resource: z.enum(["centers", "items", "couriers", "rules"]),
          id: z.string(),
        })
        .parse(req.params);
      return ok(
        await transaction(async (tx) => {
          let result;
          switch (resource) {
            case "centers":
              result = await tx.center.update({
                where: { id },
                data: masterSchemas.centers.parse(req.body),
              });
              break;
            case "items":
              result = await tx.inventoryItem.update({
                where: { id },
                data: masterSchemas.items.parse(req.body),
              });
              break;
            case "couriers": {
              const b = masterSchemas.couriers.parse(req.body);
              result = await tx.courierPartner.update({
                where: { id },
                data: { ...b, trackingUrl: b.trackingUrl || null },
              });
              break;
            }
            case "rules":
              result = await tx.courierRule.update({
                where: { id },
                data: masterSchemas.rules.parse(req.body),
              });
              break;
          }
          await audit(
            tx,
            req.employee.id,
            "MASTER_UPDATED",
            resource,
            id,
            result,
          );
          return result;
        }),
      );
    },
  );
  app.post(
    "/employees",
    { preHandler: protect(app, "employees:write") },
    async (req) => {
      const b = employeeSchema.parse(req.body);
      const passwordHash = await hashPassword(b.password);
      return ok(
        await transaction(async (tx) => {
          const e = await tx.employee.create({
            data: {
              email: b.email,
              fullName: b.fullName,
              role: b.role,
              passwordHash,
            },
          });
          await audit(
            tx,
            req.employee.id,
            "EMPLOYEE_CREATED",
            "Employee",
            e.id,
            { role: e.role },
          );
          return { id: e.id, fullName: e.fullName, role: e.role };
        }),
      );
    },
  );
  app.patch(
    "/employees/:id",
    { preHandler: protect(app, "employees:write") },
    async (req) => {
      const id = paramsId(req.params);
      const b = employeeSchema
        .pick({ fullName: true, role: true })
        .partial()
        .extend({ isActive: z.boolean().optional() })
        .parse(req.body);
      if (
        id === req.employee.id &&
        (b.isActive === false || (b.role && b.role !== "SUPER_ADMIN"))
      )
        throw new BusinessRuleError(
          "SELF_LOCKOUT",
          "Cannot deactivate or demote your own administrator account",
        );
      return ok(
        await transaction(async (tx) => {
          const e = await tx.employee.update({ where: { id }, data: b });
          await tx.session.deleteMany({ where: { employeeId: id } });
          await audit(
            tx,
            req.employee.id,
            "EMPLOYEE_UPDATED",
            "Employee",
            id,
            b,
          );
          return { id: e.id, isActive: e.isActive, role: e.role };
        }),
      );
    },
  );
  app.get("/settings", { preHandler: protect(app, "config:read") }, async () =>
    ok({
      integrations: {
        admissions: !!env.ADMISSIONS_API_KEY,
        finance: !!env.FINANCE_API_KEY,
        email: !!env.SMTP_HOST,
        sms: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_FROM),
        whatsapp: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_WHATSAPP_FROM),
      },
      settings: await prisma.systemSetting.findMany(),
    }),
  );
  app.put(
    "/settings",
    { preHandler: protect(app, "config:write") },
    async (req) => {
      const b = z
        .object({
          forecastBufferPercent: z.number().min(0).max(100),
          piiRetentionYears: z.number().int().min(1).max(10),
        })
        .parse(req.body);
      return ok(
        await transaction(async (tx) => {
          for (const [key, value] of Object.entries(b))
            await tx.systemSetting.upsert({
              where: { key },
              create: { key, value },
              update: { value },
            });
          await audit(
            tx,
            req.employee.id,
            "SETTINGS_UPDATED",
            "SystemSetting",
            "settings",
            b,
          );
          return b;
        }),
      );
    },
  );
  app.post(
    "/notifications/:id/retry",
    { preHandler: protect(app, "notifications:templates:write") },
    async (req) => {
      const id = paramsId(req.params);
      return ok(
        await transaction(async (tx) => {
          const count = await tx.notificationLog.updateMany({
            where: { id, status: { in: ["FAILED", "WAITING_CONFIGURATION"] } },
            data: {
              status: "PENDING",
              attempts: 0,
              nextAttemptAt: new Date(),
              error: null,
            },
          });
          if (!count.count)
            throw new AppError(
              409,
              "NOT_RETRYABLE",
              "Message is sent or already being processed",
            );
          await audit(
            tx,
            req.employee.id,
            "MESSAGE_RETRIED",
            "NotificationLog",
            id,
          );
          return { retried: true };
        }),
      );
    },
  );
}
