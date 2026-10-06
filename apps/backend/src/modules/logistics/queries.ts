import { Prisma, DispatchStatus, StudentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database";
import { paise, money } from "./domain";

const optionalQuery = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());
export const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().max(200).default(""),
  status: z.string().max(50).optional(),
  courseId: z.string().optional(),
  centerId: z.string().optional(),
  courierPartnerId: z.string().optional(),
  kitId: z.string().optional(),
  paymentStatus: optionalQuery(z.enum(["CLEARED", "PARTIAL", "PENDING"])),
  dispatchStatus: z.string().max(50).optional(),
  from: optionalQuery(z.iso.date()),
  to: optionalQuery(z.iso.date()),
  sort: z.enum(["asc", "desc"]).default("desc"),
});
export type Query = z.infer<typeof querySchema>;
export const range = (q: Query) =>
  q.from || q.to
    ? {
        ...(q.from ? { gte: new Date(`${q.from}T00:00:00+05:30`) } : {}),
        ...(q.to
          ? {
              lt: new Date(
                new Date(`${q.to}T00:00:00+05:30`).getTime() + 86400000,
              ),
            }
          : {}),
      }
    : undefined;
export function dispatchWhere(q: Query): Prisma.DispatchWhereInput {
  if (q.status) z.enum(DispatchStatus).parse(q.status);
  const searchFilter = q.search
    ? {
        OR: [
          { awbNumber: { contains: q.search, mode: "insensitive" as const } },
          { id: { contains: q.search, mode: "insensitive" as const } },
          { student: { name: { contains: q.search, mode: "insensitive" as const } } },
          { student: { id: { contains: q.search, mode: "insensitive" as const } } },
          { student: { mobile: { contains: q.search } } },
          { student: { pincode: { contains: q.search } } },
          { student: { city: { contains: q.search, mode: "insensitive" as const } } },
          { student: { state: { contains: q.search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  return {
    ...(q.status
      ? { status: q.status as Prisma.EnumDispatchStatusFilter }
      : {}),
    createdAt: range(q),
    courierPartnerId: q.courierPartnerId || undefined,
    kitId: q.kitId || undefined,
    ...searchFilter,
    student: {
      courseId: q.courseId || undefined,
      centerId: q.centerId || undefined,
    },
  };
}

export async function listResource(
  resource: string,
  q: Query,
  exportAll = false,
) {
  const page = {
    take: exportAll ? 10000 : q.limit,
    skip: exportAll ? 0 : (q.page - 1) * q.limit,
  };
  const search = q.search
    ? { contains: q.search, mode: "insensitive" as const }
    : undefined;
  let rows: unknown[] = [];
  let total = 0;
  const returnWhere: Prisma.ReturnRecordWhereInput = {
    status: q.status || undefined,
    createdAt: range(q),
    dispatch: { student: { centerId: q.centerId || undefined } },
    ...(search
      ? {
          OR: [{ reason: search }, { dispatch: { student: { name: search } } }],
        }
      : {}),
  };
  const orderWhere: Prisma.CenterOrderWhereInput = {
    createdAt: range(q),
    ...(q.centerId
      ? { OR: [{ fromCenterId: q.centerId }, { toCenterId: q.centerId }] }
      : {}),
    ...(search ? { AND: [{ OR: [{ id: search }, { reason: search }] }] } : {}),
  };
  const requisitionWhere: Prisma.PrintRequisitionWhereInput = {
    centerId: q.centerId || undefined,
    createdAt: range(q),
    ...(search ? { OR: [{ id: search }, { vendor: search }] } : {}),
  };
  const notificationWhere: Prisma.NotificationLogWhereInput = {
    status: q.status || undefined,
    timestamp: range(q),
    student: { centerId: q.centerId || undefined },
    ...(search
      ? {
          OR: [
            { content: search },
            { type: search },
            { student: { name: search } },
          ],
        }
      : {}),
  };
  const employeeWhere: Prisma.EmployeeWhereInput = search
    ? { OR: [{ fullName: search }, { email: search }] }
    : {};
  const priceWhere: Prisma.CoursePriceWhereInput = {
    centerId: q.centerId || undefined,
    courseId: q.courseId || undefined,
    ...(search
      ? { OR: [{ course: { name: search } }, { center: { name: search } }] }
      : {}),
  };
  const ruleWhere: Prisma.CourierRuleWhereInput = search
    ? { OR: [{ state: search }, { courier: { name: search } }] }
    : {};
  const templateWhere: Prisma.NotificationTemplateWhereInput = search
    ? { OR: [{ event: search }, { content: search }] }
    : {};
  switch (resource) {
    case "students": {
      if (q.status) z.enum(StudentStatus).parse(q.status);
      if (q.dispatchStatus) z.enum(DispatchStatus).parse(q.dispatchStatus);
      const where: Prisma.StudentWhereInput = {
        courseId: q.courseId || undefined,
        centerId: q.centerId || undefined,
        status: q.status as Prisma.EnumStudentStatusFilter | undefined,
        enrollmentDate: range(q),
        ...(q.paymentStatus === "PENDING"
          ? { milestoneStatus: { none: { paid: true } } }
          : q.paymentStatus === "CLEARED"
            ? {
                AND: [
                  { milestoneStatus: { some: { paid: true } } },
                  { milestoneStatus: { none: { paid: false } } },
                ],
              }
            : q.paymentStatus === "PARTIAL"
              ? {
                  AND: [
                    { milestoneStatus: { some: { paid: true } } },
                    { milestoneStatus: { some: { paid: false } } },
                  ],
                }
              : {}),
        ...(q.dispatchStatus
          ? {
              dispatches: {
                some: {
                  status: q.dispatchStatus as Prisma.EnumDispatchStatusFilter,
                },
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { id: search },
                { name: search },
                { mobile: search },
                { city: search },
                { state: search },
                { pincode: search },
              ],
            }
          : {}),
      };
      [rows, total] = await Promise.all([
        prisma.student.findMany({
          ...page,
          where,
          include: {
            course: true,
            center: true,
            milestoneStatus: true,
            dispatches: { select: { id: true, status: true } },
          },
          orderBy: { enrollmentDate: q.sort },
        }),
        prisma.student.count({ where }),
      ]);
      rows = rows.map((row) => {
        const s = row as {
          milestoneStatus: { paid: boolean; amount: unknown }[];
          status: string;
          dispatches: { status: string }[];
        };
        const paid = s.milestoneStatus.filter((m) => m.paid);
        return {
          ...s,
          paymentState:
            paid.length === 0
              ? "PENDING"
              : s.milestoneStatus.some((m) => !m.paid)
                ? "PARTIAL"
                : "CLEARED",
          paidAmount: money(
            paid.reduce((n, m) => n + paise(m.amount as string), 0),
          ),
          readiness:
            s.status !== "ACTIVE"
              ? "HOLD"
              : s.dispatches.some((d) => d.status === "QUEUED")
                ? "READY"
                : s.dispatches.some((d) => d.status === "ADDRESS_FLAGGED")
                  ? "ADDRESS_ISSUE"
                  : paid.length
                    ? "CHECK_KITS"
                    : "PAYMENT_PENDING",
        };
      });
      break;
    }
    case "dispatches": {
      const where = dispatchWhere(q);
      [rows, total] = await Promise.all([
        prisma.dispatch.findMany({
          ...page,
          where,
          include: {
            student: { include: { course: true, center: true } },
            kit: true,
            courierPartner: true,
            trackingHistory: { orderBy: { timestamp: "asc" } },
          },
          orderBy: { createdAt: q.sort },
        }),
        prisma.dispatch.count({ where }),
      ]);
      break;
    }
    case "inventory": {
      const where = {
        centerId: q.centerId || undefined,
        updatedAt: range(q),
        item: search ? { name: search } : undefined,
      };
      [rows, total] = await Promise.all([
        prisma.stock.findMany({
          ...page,
          where,
          include: { item: true, center: true },
          orderBy: { updatedAt: q.sort },
        }),
        prisma.stock.count({ where }),
      ]);
      break;
    }
    case "ledger": {
      const where = {
        centerId: q.centerId || undefined,
        createdAt: range(q),
        ...(search
          ? { OR: [{ reason: search }, { item: { name: search } }] }
          : {}),
      };
      [rows, total] = await Promise.all([
        prisma.stockMovement.findMany({
          ...page,
          where,
          include: { item: true },
          orderBy: { createdAt: q.sort },
        }),
        prisma.stockMovement.count({ where }),
      ]);
      break;
    }
    case "transfers": {
      const where: Prisma.TransferWhereInput = {
        status: q.status || undefined,
        requestDate: range(q),
        student: { centerId: q.centerId || undefined },
        ...(search
          ? {
              OR: [
                { student: { name: search } },
                { studentId: search },
                { reason: search },
              ],
            }
          : {}),
      };
      [rows, total] = await Promise.all([
        prisma.transfer.findMany({
          ...page,
          where,
          include: { student: true },
          orderBy: { requestDate: q.sort },
        }),
        prisma.transfer.count({ where }),
      ]);
      break;
    }
    case "returns":
      [rows, total] = await Promise.all([
        prisma.returnRecord.findMany({
          ...page,
          where: returnWhere,
          include: { dispatch: { include: { student: true, kit: true } } },
          orderBy: { createdAt: q.sort },
        }),
        prisma.returnRecord.count({ where: returnWhere }),
      ]);
      break;
    case "orders":
      [rows, total] = await Promise.all([
        prisma.centerOrder.findMany({
          ...page,
          where: orderWhere,
          include: { lines: true },
          orderBy: { createdAt: q.sort },
        }),
        prisma.centerOrder.count({ where: orderWhere }),
      ]);
      break;
    case "requisitions":
      [rows, total] = await Promise.all([
        prisma.printRequisition.findMany({
          ...page,
          where: requisitionWhere,
          include: { lines: true },
          orderBy: { createdAt: q.sort },
        }),
        prisma.printRequisition.count({ where: requisitionWhere }),
      ]);
      break;
    case "notifications":
      [rows, total] = await Promise.all([
        prisma.notificationLog.findMany({
          ...page,
          where: notificationWhere,
          include: { student: { select: { id: true, name: true } } },
          orderBy: { timestamp: q.sort },
        }),
        prisma.notificationLog.count({
          where: notificationWhere,
        }),
      ]);
      break;
    case "audit":
      [rows, total] = await Promise.all([
        prisma.auditLog.findMany({
          ...page,
          where: { timestamp: range(q), ...(search ? { action: search } : {}) },
          include: { employee: { select: { fullName: true } } },
          orderBy: { timestamp: q.sort },
        }),
        prisma.auditLog.count({
          where: { timestamp: range(q), ...(search ? { action: search } : {}) },
        }),
      ]);
      rows = rows.map((r) => {
        const a = r as { id: bigint };
        return { ...a, id: String(a.id) };
      });
      break;
    case "employees":
      [rows, total] = await Promise.all([
        prisma.employee.findMany({
          ...page,
          where: employeeWhere,
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: q.sort },
        }),
        prisma.employee.count({ where: employeeWhere }),
      ]);
      break;
    case "kits":
      [rows, total] = await Promise.all([
        prisma.kit.findMany({
          ...page,
          where: { name: search },
          include: { course: true, items: { include: { item: true } } },
        }),
        prisma.kit.count({ where: { name: search } }),
      ]);
      break;
    case "items":
      [rows, total] = await Promise.all([
        prisma.inventoryItem.findMany({
          ...page,
          where: { name: search },
          orderBy: { name: "asc" },
        }),
        prisma.inventoryItem.count({ where: { name: search } }),
      ]);
      break;
    case "centers":
      [rows, total] = await Promise.all([
        prisma.center.findMany({
          ...page,
          where: { name: search },
          orderBy: { name: "asc" },
        }),
        prisma.center.count({ where: { name: search } }),
      ]);
      break;
    case "courses":
      [rows, total] = await Promise.all([
        prisma.course.findMany({
          ...page,
          where: { name: search },
          orderBy: { name: "asc" },
        }),
        prisma.course.count({ where: { name: search } }),
      ]);
      break;
    case "prices":
      [rows, total] = await Promise.all([
        prisma.coursePrice.findMany({
          ...page,
          where: priceWhere,
          include: { course: true, center: true },
        }),
        prisma.coursePrice.count({ where: priceWhere }),
      ]);
      break;
    case "couriers":
      [rows, total] = await Promise.all([
        prisma.courierPartner.findMany({ ...page, where: { name: search } }),
        prisma.courierPartner.count({ where: { name: search } }),
      ]);
      break;
    case "rules":
      [rows, total] = await Promise.all([
        prisma.courierRule.findMany({
          ...page,
          where: ruleWhere,
          include: { courier: true },
          orderBy: { priority: "asc" },
        }),
        prisma.courierRule.count({ where: ruleWhere }),
      ]);
      break;
    case "pincodes":
      [rows, total] = await Promise.all([
        prisma.pincode.findMany({
          ...page,
          where: { code: search },
          orderBy: { code: "asc" },
        }),
        prisma.pincode.count({ where: { code: search } }),
      ]);
      break;
    case "templates":
      [rows, total] = await Promise.all([
        prisma.notificationTemplate.findMany({ ...page, where: templateWhere }),
        prisma.notificationTemplate.count({ where: templateWhere }),
      ]);
      break;
  }
  return {
    rows,
    total,
    page: q.page,
    limit: exportAll ? 10000 : q.limit,
    truncated: exportAll && total > 10000,
  };
}

export async function dashboard(q: Query) {
  const where = dispatchWhere(q);
  const studentWhere = {
    courseId: q.courseId || undefined,
    centerId: q.centerId || undefined,
  };
  const indiaNow = new Date(Date.now() + 330 * 60000),
    weekDay = (indiaNow.getUTCDay() + 6) % 7;
  const weekStart = new Date(
    Date.UTC(
      indiaNow.getUTCFullYear(),
      indiaNow.getUTCMonth(),
      indiaNow.getUTCDate() - weekDay,
    ) -
      330 * 60000,
  );
  const monthStart = new Date(
    Date.UTC(indiaNow.getUTCFullYear(), indiaNow.getUTCMonth(), 1) -
      330 * 60000,
  );
  const [readyStudents, dispatchedWeek, dispatchedMonth] = await Promise.all([
    prisma.student.count({
      where: {
        ...studentWhere,
        dispatches: { some: { ...where, status: "QUEUED" } },
      },
    }),
    prisma.dispatch.count({
      where: {
        ...where,
        createdAt: undefined,
        dispatchedAt: { gte: weekStart },
      },
    }),
    prisma.dispatch.count({
      where: {
        ...where,
        createdAt: undefined,
        dispatchedAt: { gte: monthStart },
      },
    }),
  ]);
  const [
    students,
    states,
    transfers,
    stocks,
    requisitions,
    monthly,
    courses,
    centers,
    couriers,
    milestones,
    activity,
  ] = await Promise.all([
    prisma.student.count({ where: { ...studentWhere, status: "ACTIVE" } }),
    prisma.dispatch.groupBy({ by: ["status"], where, _count: true }),
    prisma.transfer.count({
      where: { status: { in: ["PENDING", "APPROVED_AWAITING_SYNC"] } },
    }),
    prisma.stock.findMany({
      include: { item: true, center: true },
      where: { centerId: q.centerId || undefined },
    }),
    prisma.printRequisition.count({ where: { status: { not: "RECEIVED" } } }),
    prisma.$queryRaw<
      { month: string; count: bigint }[]
    >`SELECT to_char(date_trunc('month', d."createdAt"), 'YYYY-MM') AS month, count(*) FROM "Dispatch" d JOIN "Student" s ON s.id=d."studentId" WHERE d."createdAt">=date_trunc('month', CURRENT_DATE)-interval '11 months' AND (${q.courseId ?? null}::text IS NULL OR s."courseId"=${q.courseId ?? null}) AND (${q.centerId ?? null}::text IS NULL OR s."centerId"=${q.centerId ?? null}) GROUP BY 1 ORDER BY 1`,
    prisma.student.groupBy({
      by: ["courseId"],
      where: { ...studentWhere, status: "ACTIVE" },
      _count: true,
    }),
    prisma.center.findMany({
      include: { _count: { select: { students: true } } },
    }),
    prisma.courierPartner.findMany(),
    prisma.milestoneStatus.groupBy({
      by: ["paid"],
      where: { student: studentWhere },
      _count: true,
    }),
    prisma.trackingEvent.findMany({
      orderBy: { timestamp: "desc" },
      take: 8,
      include: {
        dispatch: {
          include: { kit: true, student: { select: { name: true } } },
        },
      },
    }),
  ]);
  const counts = Object.fromEntries(states.map((s) => [s.status, s._count]));
  const ready = counts.QUEUED ?? 0;
  const blocked = await prisma.student.count({
    where: {
      ...studentWhere,
      OR: [
        { status: { in: ["HOLD", "DROPPED"] } },
        { milestoneStatus: { none: { paid: true } } },
      ],
    },
  });
  const courierGroups = await prisma.dispatch.groupBy({
    by: ["courierPartnerId", "status"],
    where,
    _count: true,
    _sum: { materialCost: true },
  });
  const centerDispatches = await prisma.$queryRaw<
    { name: string; count: bigint }[]
  >`SELECT c.name, count(*) FROM "Dispatch" d JOIN "Student" s ON s.id=d."studentId" JOIN "Center" c ON c.id=s."centerId" WHERE (${q.courseId ?? null}::text IS NULL OR s."courseId"=${q.courseId ?? null}) AND (${q.centerId ?? null}::text IS NULL OR s."centerId"=${q.centerId ?? null}) GROUP BY c.id,c.name ORDER BY count(*) DESC`;
  const courseMilestones = await prisma.$queryRaw<
    { name: string; total: bigint; cleared: bigint }[]
  >`SELECT c.name, count(*) AS total, count(*) FILTER (WHERE m.paid) AS cleared FROM "MilestoneStatus" m JOIN "Student" s ON s.id=m."studentId" JOIN "Course" c ON c.id=s."courseId" WHERE (${q.courseId ?? null}::text IS NULL OR s."courseId"=${q.courseId ?? null}) AND (${q.centerId ?? null}::text IS NULL OR s."centerId"=${q.centerId ?? null}) GROUP BY c.id,c.name`;
  return {
    activeStudents: students,
    ready,
    readyStudents,
    dispatchedWeek,
    dispatchedMonth,
    blocked,
    openTransfers: transfers,
    pendingPrint: requisitions,
    lowStock: stocks.filter((s) => s.quantity <= s.item.lowStockThreshold),
    statuses: counts,
    monthly: monthly.map((m) => ({ month: m.month, count: Number(m.count) })),
    courses,
    centers,
    centerDispatches: centerDispatches.map((c) => ({
      name: c.name,
      count: Number(c.count),
    })),
    courseMilestones: courseMilestones.map((c) => ({
      name: c.name,
      total: Number(c.total),
      cleared: Number(c.cleared),
    })),
    courierPerformance: couriers.map((c) => {
      const group = courierGroups.filter((g) => g.courierPartnerId === c.id);
      return {
        name: c.name,
        total: group.reduce((n, g) => n + g._count, 0),
        delivered: group
          .filter((g) => g.status === "DELIVERED")
          .reduce((n, g) => n + g._count, 0),
        cost: money(
          group.reduce((n, g) => n + paise(g._sum.materialCost ?? 0), 0),
        ),
      };
    }),
    milestones,
    activity,
  };
}

export async function forecast(centerId?: string, bufferPercent = 5) {
  const [kits, grouped, stocks, settings] = await Promise.all([
    prisma.kit.findMany({ include: { items: { include: { item: true } } } }),
    // Demand includes unpaid active students; fulfilled current-enrolment kits are subtracted below.
    prisma.student.groupBy({
      by: ["courseId"],
      where: { status: "ACTIVE" },
      _count: true,
    }),
    prisma.stock.groupBy({
      by: ["itemId"],
      where: { centerId },
      _sum: { quantity: true },
    }),
    prisma.systemSetting.findUnique({
      where: { key: "forecastBufferPercent" },
    }),
  ]);
  const configured = Number(settings?.value ?? bufferPercent);
  const demand = new Map<
    string,
    {
      itemId: string;
      name: string;
      required: number;
      stock: number;
      quantity: number;
      cost: string;
    }
  >();
  const fulfilledGroups = await prisma.$queryRaw<
    { kitId: string; count: bigint }[]
  >`SELECT d."kitId", count(*) FROM "Dispatch" d JOIN "Student" s ON s.id=d."studentId" WHERE s.status='ACTIVE' AND d."enrollmentVersion"=s."enrollmentVersion" AND d.status IN ('PACKED','HANDED_TO_COURIER','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED') GROUP BY d."kitId"`;
  for (const kit of kits) {
    if (!kit.courseId) continue;
    const n = grouped.find((g) => g.courseId === kit.courseId)?._count ?? 0;
    const fulfilled = Number(
      fulfilledGroups.find((g) => g.kitId === kit.id)?.count ?? 0,
    );
    for (const l of kit.items) {
      const existing = demand.get(l.itemId) ?? {
        itemId: l.itemId,
        name: l.item.name,
        required: 0,
        stock: stocks.find((s) => s.itemId === l.itemId)?._sum.quantity ?? 0,
        quantity: 0,
        cost: String(l.item.unitCost),
      };
      existing.required += Math.max(0, n - fulfilled) * l.quantity;
      demand.set(l.itemId, existing);
    }
  }
  return [...demand.values()].map((d) => ({
    ...d,
    quantity: Math.max(
      0,
      Math.ceil(d.required * (1 + configured / 100)) - d.stock,
    ),
  }));
}
