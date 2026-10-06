import { FastifyInstance, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../config/database";
import { AppError, BusinessRuleError } from "../../shared/errors";
import { masterSchemas, paymentSchema, studentSchema } from "./schemas";
import { audit, moveStock, transaction, Tx } from "./transaction";
import { notify, rebuildQueue, pendingStatuses } from "./dispatch.service";
import { ok } from "../../http";

export function verifyProvider(
  req: FastifyRequest,
  source: "admissions" | "finance",
) {
  const expected =
    source === "finance" ? env.FINANCE_API_KEY : env.ADMISSIONS_API_KEY;
  const supplied = req.headers["x-provider-key"];
  if (
    !expected ||
    typeof supplied !== "string" ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    throw new AppError(
      403,
      "PROVIDER_KEY_REQUIRED",
      `A scoped ${source} provider key is required`,
    );
}
export async function providerActor() {
  const employee = env.INTEGRATION_ACTOR_EMAIL
    ? await prisma.employee.findUnique({
        where: { email: env.INTEGRATION_ACTOR_EMAIL },
      })
    : await prisma.employee.findFirst({
        where: { role: "SUPER_ADMIN", isActive: true },
        orderBy: { createdAt: "asc" },
      });
  if (!employee?.isActive)
    throw new AppError(
      503,
      "NO_SERVICE_ACTOR",
      "Configure an active integration service employee",
    );
  return employee.id;
}

export async function ingestStudents(tx: Tx, actor: string, rows: unknown[]) {
  const ids: string[] = [];
  for (const row of rows) {
    const b = studentSchema.parse(row);
    const existing = await tx.student.findUnique({ where: { id: b.id } });
    const changed =
      !!existing &&
      (existing.courseId !== b.courseId || existing.centerId !== b.centerId);
    if (changed) {
      const open = await tx.transfer.findFirst({
        where: {
          studentId: b.id,
          status: { in: ["PENDING", "APPROVED_AWAITING_SYNC"] },
        },
      });
      if (
        open &&
        (open.status !== "APPROVED_AWAITING_SYNC" ||
          open.toCourseId !== b.courseId ||
          open.toCenterId !== b.centerId)
      )
        throw new BusinessRuleError(
          "TRANSFER_CONFLICT",
          "Admissions update conflicts with unresolved transfer",
        );
      const pending = await tx.dispatch.findMany({
        where: { studentId: b.id, status: { in: pendingStatuses } },
      });
      for (const d of pending) {
        if (d.warehouseId && Array.isArray(d.packedItems)) {
          const lines = z
            .array(z.object({ itemId: z.string(), quantity: z.number() }))
            .parse(d.packedItems);
          for (const l of lines)
            await moveStock(
              tx,
              actor,
              l.itemId,
              d.warehouseId,
              l.quantity,
              "ENROLLMENT_UNPACK",
              d.id,
            );
        }
        await tx.dispatch.update({
          where: { id: d.id },
          data: {
            status: "HOLD",
            packedItems: [],
            materialCost: 0,
            warehouseId: null,
          },
        });
      }
      await tx.milestoneStatus.deleteMany({ where: { studentId: b.id } });
      if (open)
        await tx.transfer.update({
          where: { id: open.id },
          data: { status: "COMPLETED" },
        });
    }
    await tx.student.upsert({
      where: { id: b.id },
      create: {
        ...b,
        completedAt: b.status === "COMPLETED" ? new Date() : undefined,
      },
      update: {
        ...b,
        enrollmentVersion: changed ? { increment: 1 } : undefined,
        completedAt:
          b.status === "COMPLETED"
            ? (existing?.completedAt ?? new Date())
            : null,
      },
    });
    await audit(tx, actor, "ADMISSIONS_SYNC", "Student", b.id, {
      status: b.status,
      courseId: b.courseId,
      centerId: b.centerId,
    });
    if (changed) await notify(tx, b.id, "TRANSFER_CONFIRMED");
    ids.push(b.id);
  }
  await rebuildQueue(tx, actor, ids);
  return { processed: ids.length };
}
export async function ingestPayments(tx: Tx, actor: string, rows: unknown[]) {
  const ids: string[] = [];
  for (const row of rows) {
    const b = paymentSchema.parse(row);
    await tx.milestoneStatus.upsert({
      where: {
        studentId_milestoneNumber: {
          studentId: b.studentId,
          milestoneNumber: b.milestoneNumber,
        },
      },
      create: {
        ...b,
        paidAt: b.paid ? (b.paidAt ?? new Date()) : null,
        syncedFromERP: new Date(),
      },
      update: {
        ...b,
        paidAt: b.paid ? (b.paidAt ?? new Date()) : null,
        syncedFromERP: new Date(),
      },
    });
    await audit(
      tx,
      actor,
      "FINANCE_SYNC",
      "MilestoneStatus",
      `${b.studentId}:${b.milestoneNumber}`,
      { paid: b.paid, amount: b.amount },
    );
    ids.push(b.studentId);
  }
  await rebuildQueue(tx, actor, [...new Set(ids)]);
  return { processed: rows.length };
}
export async function integrationRoutes(app: FastifyInstance) {
  for (const kind of ["students", "payments"] as const)
    app.post(
      `/${kind}`,
      { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
      async (req) => {
        const source = kind === "students" ? "admissions" : "finance";
        verifyProvider(req, source);
        const b = z
          .object({
            eventId: z.string().min(1).max(100),
            rows: z.array(z.unknown()).min(1).max(1000),
          })
          .parse(req.body);
        const eventId = `${source}:${b.eventId}`;
        if (
          await prisma.integrationEvent.findUnique({ where: { id: eventId } })
        )
          return ok({ duplicate: true });
        const actor = await providerActor();
        return ok(
          await transaction(async (tx) => {
            await tx.integrationEvent.create({ data: { id: eventId, source } });
            return kind === "students"
              ? ingestStudents(tx, actor, b.rows)
              : ingestPayments(tx, actor, b.rows);
          }),
        );
      },
    );
  app.post("/catalog", async (req) => {
    verifyProvider(req, "finance");
    const b = z
      .object({
        eventId: z.string().min(1).max(100),
        courses: z
          .array(masterSchemas.courses.extend({ id: z.string() }))
          .max(1000)
          .default([]),
        prices: z.array(masterSchemas.prices).max(1000).default([]),
        plans: z
          .array(z.object({ id: z.string(), name: z.string() }))
          .max(100)
          .default([]),
      })
      .parse(req.body);
    const eventId = `finance:catalog:${b.eventId}`;
    if (await prisma.integrationEvent.findUnique({ where: { id: eventId } }))
      return ok({ duplicate: true });
    const actor = await providerActor();
    return ok(
      await transaction(async (tx) => {
        await tx.integrationEvent.create({
          data: { id: eventId, source: "finance" },
        });
        for (const c of b.courses)
          await tx.course.upsert({ where: { id: c.id }, create: c, update: c });
        for (const p of b.plans)
          await tx.paymentPlan.upsert({
            where: { id: p.id },
            create: p,
            update: p,
          });
        for (const p of b.prices)
          await tx.coursePrice.upsert({
            where: {
              courseId_centerId: { courseId: p.courseId, centerId: p.centerId },
            },
            create: p,
            update: { fee: p.fee },
          });
        await audit(tx, actor, "FINANCE_CATALOG_SYNC", "Course", eventId, {
          courses: b.courses.length,
          prices: b.prices.length,
        });
        return {
          processed: b.courses.length + b.prices.length + b.plans.length,
        };
      }),
    );
  });
}
