import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BusinessRuleError, NotFoundError } from "../../shared/errors";
import { addressErrors, assertTransition, money, paise } from "./domain";
import { dispatchSchema } from "./schemas";
import { Tx } from "./transaction";

// All reads, conditional stock debits and history writes share the caller's
// serializable transaction. Batching removes repeated lookups without caching eligibility.
export async function packDispatches(
  tx: Tx,
  actor: string,
  input: z.infer<typeof dispatchSchema>,
) {
  const ids = [...new Set(input.ids)];
  if (!input.warehouseId)
    throw new BusinessRuleError(
      "BOM_REQUIRED",
      "Select warehouse and configure kit composition",
    );
  if (!(await tx.center.findUnique({ where: { id: input.warehouseId } })))
    throw new BusinessRuleError("INVALID_STOCK", "Unknown warehouse");
  const dispatches = await tx.dispatch.findMany({
    where: { id: { in: ids } },
    include: {
      kit: { include: { items: { include: { item: true } } } },
      courierPartner: true,
      student: {
        include: {
          course: true,
          milestoneStatus: true,
          transfers: {
            where: { status: { in: ["PENDING", "APPROVED_AWAITING_SYNC"] } },
            select: { id: true },
          },
        },
      },
    },
  });
  if (dispatches.length !== ids.length) throw new NotFoundError("Dispatch");
  const postcodes = new Map(
    (
      await tx.pincode.findMany({
        where: {
          code: { in: [...new Set(dispatches.map((d) => d.student.pincode))] },
        },
      })
    ).map((p) => [p.code, p]),
  );
  const required = new Map<string, { quantity: number; name: string }>();
  const movements: Prisma.StockMovementCreateManyInput[] = [],
    events: Prisma.TrackingEventCreateManyInput[] = [],
    audits: Prisma.AuditLogCreateManyInput[] = [],
    notifications: Prisma.NotificationLogCreateManyInput[] = [];
  const template = await tx.notificationTemplate.findUnique({
    where: { event: "PACKED" },
  });
  for (const d of dispatches) {
    assertTransition(d.status, "PACKED");
    const s = d.student;
    if (s.status !== "ACTIVE" || s.courseId !== d.kit.courseId)
      throw new BusinessRuleError(
        "BR-03",
        "Student is inactive, on hold or in a different course",
      );
    if (s.transfers.length)
      throw new BusinessRuleError(
        "BR-04",
        "Transfer must be resolved before packing",
      );
    if (
      !s.milestoneStatus.some(
        (m) => m.milestoneNumber === d.kit.milestoneNumber && m.paid,
      )
    )
      throw new BusinessRuleError(
        "BR-01",
        "Required payment milestone is not cleared",
      );
    const flags = addressErrors(s, postcodes.get(s.pincode));
    if (flags.length) throw new BusinessRuleError("BR-07", flags.join("; "));
    if (d.enrollmentVersion !== s.enrollmentVersion)
      throw new BusinessRuleError(
        "STALE_ENROLLMENT",
        "Dispatch belongs to a previous enrolment",
      );
    if (!d.kit.items.length)
      throw new BusinessRuleError("BOM_REQUIRED", "Configure kit composition");
    if (d.packedItems && d.warehouseId !== input.warehouseId)
      throw new BusinessRuleError(
        "WAREHOUSE_MISMATCH",
        "Resume the original packing warehouse",
      );
    if (
      input.courierPartnerId &&
      input.courierPartnerId !== d.courierPartnerId &&
      (!input.reason || input.reason.trim().length < 5)
    )
      throw new BusinessRuleError(
        "BR-06",
        "Courier override requires a reason",
      );
    if (!d.packedItems)
      for (const line of d.kit.items) {
        const r = required.get(line.itemId) ?? {
          quantity: 0,
          name: line.item.name,
        };
        r.quantity += line.quantity;
        required.set(line.itemId, r);
        movements.push({
          employeeId: actor,
          itemId: line.itemId,
          centerId: input.warehouseId,
          quantity: -line.quantity,
          reason: "KIT_PACKED",
          reference: d.id,
        });
      }
  }
  for (const [itemId, r] of required) {
    const changed = await tx.stock.updateMany({
      where: {
        itemId,
        centerId: input.warehouseId,
        quantity: { gte: r.quantity },
      },
      data: { quantity: { decrement: r.quantity } },
    });
    if (changed.count !== 1)
      throw new BusinessRuleError(
        "INSUFFICIENT_STOCK",
        `Insufficient stock for ${r.name}`,
      );
  }
  const overrideCourier = input.courierPartnerId
    ? await tx.courierPartner.findUnique({
        where: { id: input.courierPartnerId },
      })
    : null;
  if (input.courierPartnerId && !overrideCourier)
    throw new BusinessRuleError(
      "COURIER_REQUIRED",
      "Choose an existing courier",
    );
  for (const d of dispatches) {
    const s = d.student;
    const data: Prisma.DispatchUncheckedUpdateInput = {
      status: "PACKED",
      deliveryMode: input.deliveryMode,
      expectedDelivery: input.expectedDelivery
        ? new Date(input.expectedDelivery)
        : undefined,
      expectedDispatch: input.expectedDispatch
        ? new Date(input.expectedDispatch)
        : undefined,
      addressSnapshot: {
        name: s.name,
        mobile: s.mobile,
        address: s.address,
        city: s.city,
        state: s.state,
        pincode: s.pincode,
      },
    };
    if (!d.packedItems) {
      data.warehouseId = input.warehouseId;
      data.packedItems = d.kit.items.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitCost: String(l.item.unitCost),
      }));
      data.materialCost = money(
        d.kit.items.reduce(
          (n, l) => n + paise(l.item.unitCost) * l.quantity,
          0,
        ),
      );
    }
    if (
      input.courierPartnerId &&
      input.courierPartnerId !== d.courierPartnerId
    ) {
      data.courierPartnerId = input.courierPartnerId;
      data.overrideReason = input.reason;
    }
    await tx.dispatch.update({ where: { id: d.id }, data });
    events.push({
      dispatchId: d.id,
      status: "PACKED",
      location: input.location,
      reason: input.reason,
    });
    audits.push({
      employeeId: actor,
      action: "STATUS_CHANGED",
      entity: "Dispatch",
      entityId: d.id,
      after: {
        from: d.status,
        to: "PACKED",
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });
    if (template?.enabled) {
      const vars: Record<string, string> = {
        Name: s.name,
        Course: s.course.name,
        Kit: d.kit.name,
        Courier: overrideCourier?.name ?? d.courierPartner?.name ?? "",
        AWB: d.awbNumber ?? "",
        Date:
          (input.expectedDelivery
            ? new Date(input.expectedDelivery)
            : d.expectedDelivery
          )
            ?.toISOString()
            .slice(0, 10) ?? "to be confirmed",
      };
      notifications.push({
        studentId: d.studentId,
        type: "PACKED",
        channel: template.channel,
        content: template.content.replace(
          /\[([A-Za-z]+)\]/g,
          (all, key) => vars[key] ?? all,
        ),
        status: "PENDING",
      });
    }
  }
  if (movements.length) await tx.stockMovement.createMany({ data: movements });
  await tx.trackingEvent.createMany({ data: events });
  await tx.auditLog.createMany({ data: audits });
  if (notifications.length)
    await tx.notificationLog.createMany({ data: notifications });
  return { updated: ids.length };
}
