import { z } from "zod";
import { BusinessRuleError, NotFoundError } from "../../shared/errors";
import {
  approvalSchema,
  orderSchema,
  receiptSchema,
  requisitionSchema,
  transferSchema,
} from "./schemas";
import { audit, moveStock, transaction } from "./transaction";
import { money, paise, reconciliation } from "./domain";
import { notify, pendingStatuses, rebuildQueue } from "./dispatch.service";

export async function requestTransfer(
  actor: string,
  b: z.infer<typeof transferSchema>,
) {
  return transaction(async (tx) => {
    const s = await tx.student.findUniqueOrThrow({
      where: { id: b.studentId },
      include: { milestoneStatus: true, dispatches: true },
    });
    if (s.courseId === b.toCourseId && s.centerId === b.toCenterId)
      throw new BusinessRuleError(
        "SAME_ENROLLMENT",
        "Choose a different course or centre",
      );
    if (
      await tx.transfer.count({
        where: {
          studentId: s.id,
          status: { in: ["PENDING", "APPROVED_AWAITING_SYNC"] },
        },
      })
    )
      throw new BusinessRuleError(
        "OPEN_TRANSFER",
        "Student already has an open transfer",
      );
    const course = await tx.course.findUniqueOrThrow({
      where: { id: b.toCourseId },
    });
    await tx.center.findUniqueOrThrow({ where: { id: b.toCenterId } });
    const price = await tx.coursePrice.findUnique({
      where: {
        courseId_centerId: { courseId: b.toCourseId, centerId: b.toCenterId },
      },
    });
    const paid = s.milestoneStatus
      .filter((m) => m.paid)
      .reduce((n, m) => n + paise(m.amount), 0);
    const materials = s.dispatches
      .filter((d) => d.dispatchedAt)
      .reduce((n, d) => n + paise(d.materialCost), 0);
    const fee = paise(price?.fee ?? course.fee);
    const calc = reconciliation(paid, materials, fee);
    const transfer = await tx.transfer.create({
      data: {
        studentId: s.id,
        fromCenterId: s.centerId,
        toCenterId: b.toCenterId,
        fromCourseId: s.courseId,
        toCourseId: b.toCourseId,
        status: "PENDING",
        amountPaid: money(paid),
        materialCost: money(materials),
        usableCredit: money(calc.credit),
        targetFee: money(fee),
        balance: money(fee - calc.credit),
        reason: b.reason,
      },
    });
    const pending = s.dispatches.filter((d) =>
      pendingStatuses.includes(d.status),
    );
    for (const d of pending) {
      await tx.dispatch.update({
        where: { id: d.id },
        data: { status: "HOLD" },
      });
      await tx.trackingEvent.create({
        data: {
          dispatchId: d.id,
          status: "HOLD",
          reason: `Transfer ${transfer.id}`,
        },
      });
    }
    await audit(
      tx,
      actor,
      "TRANSFER_REQUESTED",
      "Transfer",
      transfer.id,
      transfer,
    );
    return transfer;
  });
}

export async function approveTransfer(
  actor: string,
  transferId: string,
  b: z.infer<typeof approvalSchema>,
) {
  return transaction(async (tx) => {
    const t = await tx.transfer.findUniqueOrThrow({
      where: { id: transferId },
    });
    if (t.status !== "PENDING")
      throw new BusinessRuleError(
        "ALREADY_RESOLVED",
        "Transfer is already resolved",
      );
    const result = await tx.transfer.update({
      where: { id: t.id },
      data: {
        status: b.approved ? "APPROVED_AWAITING_SYNC" : "REJECTED",
        resolution: b.resolution,
        reason: `${t.reason ?? ""}\n${b.reason}`,
        approvedById: actor,
        approvalDate: new Date(),
      },
    });
    if (!b.approved) {
      // Original packed stock remains reserved. Rejected transfers restore the prior packing stage.
      const held = await tx.dispatch.findMany({
        where: {
          studentId: t.studentId,
          status: "HOLD",
          enrollmentVersion: (
            await tx.student.findUniqueOrThrow({ where: { id: t.studentId } })
          ).enrollmentVersion,
        },
      });
      for (const d of held) {
        const student = await tx.student.findUniqueOrThrow({
          where: { id: t.studentId },
          include: { milestoneStatus: true },
        });
        const kit = await tx.kit.findUniqueOrThrow({ where: { id: d.kitId } });
        if (
          student.status === "ACTIVE" &&
          student.milestoneStatus.some(
            (m) => m.paid && m.milestoneNumber === kit.milestoneNumber,
          )
        ) {
          await tx.dispatch.update({
            where: { id: d.id },
            data: { status: d.packedItems ? "PACKED" : "ADDRESS_FLAGGED" },
          });
          await tx.trackingEvent.create({
            data: {
              dispatchId: d.id,
              status: d.packedItems ? "PACKED" : "ADDRESS_FLAGGED",
              reason:
                "Transfer rejected; address/payment revalidation required",
            },
          });
        }
      }
      await rebuildQueue(tx, actor, [t.studentId]);
    }
    await audit(
      tx,
      actor,
      b.approved ? "TRANSFER_APPROVED" : "TRANSFER_REJECTED",
      "Transfer",
      t.id,
      result,
    );
    return result;
  });
}

export async function receiveReturn(
  actor: string,
  returnId: string,
  condition: string,
) {
  return transaction(async (tx) => {
    const r = await tx.returnRecord.findUnique({
      where: { id: returnId },
      include: { dispatch: true },
    });
    if (!r) throw new NotFoundError("Return");
    if (r.status === "RECEIVED")
      throw new BusinessRuleError(
        "ALREADY_RECEIVED",
        "Return was already reconciled",
      );
    const d = r.dispatch;
    if (d.status !== "RTO_INITIATED")
      throw new BusinessRuleError(
        "RTO_REQUIRED",
        "Initiate RTO before receiving the return",
      );
    if (!d.warehouseId || !Array.isArray(d.packedItems))
      throw new BusinessRuleError(
        "NO_PACKING_RECORD",
        "No packing snapshot found",
      );
    const lines = z
      .array(
        z.object({ itemId: z.string(), quantity: z.number().int().positive() }),
      )
      .parse(d.packedItems);
    for (const l of lines)
      await moveStock(
        tx,
        actor,
        l.itemId,
        d.warehouseId,
        condition === "UNUSABLE" ? 0 : l.quantity,
        "RETURN_RECEIVED",
        r.id,
        condition === "UNUSABLE" ? l.quantity : 0,
      );
    await tx.dispatch.update({
      where: { id: d.id },
      data: { status: "RETURNED" },
    });
    await tx.trackingEvent.create({
      data: { dispatchId: d.id, status: "RETURNED", reason: condition },
    });
    const result = await tx.returnRecord.update({
      where: { id: r.id },
      data: { status: "RECEIVED", condition, receivedAt: new Date() },
    });
    await audit(tx, actor, "RETURN_RECEIVED", "Return", r.id, result);
    return result;
  });
}

export async function createCenterOrder(
  actor: string,
  b: z.infer<typeof orderSchema>,
) {
  return transaction(async (tx) => {
    await tx.center.findUniqueOrThrow({ where: { id: b.fromCenterId } });
    await tx.center.findUniqueOrThrow({ where: { id: b.toCenterId } });
    for (const l of b.lines)
      await tx.inventoryItem.findUniqueOrThrow({ where: { id: l.itemId } });
    const order = await tx.centerOrder.create({
      data: { ...b, createdById: actor, lines: { create: b.lines } },
      include: { lines: true },
    });
    await audit(tx, actor, "CENTER_REQUESTED", "CenterOrder", order.id, order);
    return order;
  });
}

export async function dispatchCenterOrder(
  actor: string,
  orderId: string,
  awbNumber: string,
) {
  return transaction(async (tx) => {
    const o = await tx.centerOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: true },
    });
    if (o.status !== "REQUESTED")
      throw new BusinessRuleError(
        "INVALID_ORDER_STATE",
        "Only requested orders can be dispatched",
      );
    for (const l of o.lines)
      await moveStock(
        tx,
        actor,
        l.itemId,
        o.fromCenterId,
        -l.quantity,
        "CENTER_OUTWARD",
        o.id,
      );
    const result = await tx.centerOrder.update({
      where: { id: o.id },
      data: { status: "IN_TRANSIT", awbNumber },
    });
    await audit(tx, actor, "CENTER_DISPATCHED", "CenterOrder", o.id, result);
    return result;
  });
}

export async function receiveCenterOrder(
  actor: string,
  orderId: string,
  b: z.infer<typeof receiptSchema>,
) {
  return transaction(async (tx) => {
    const o = await tx.centerOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: true },
    });
    if (o.status !== "IN_TRANSIT")
      throw new BusinessRuleError(
        "INVALID_ORDER_STATE",
        "Only in-transit orders can be received once",
      );
    if (
      b.lines.length !== o.lines.length ||
      new Set(b.lines.map((l) => l.itemId)).size !== o.lines.length
    )
      throw new BusinessRuleError(
        "ALL_LINES_REQUIRED",
        "Confirm every ordered item once",
      );
    let discrepancy = false;
    for (const l of o.lines) {
      const r = b.lines.find((x) => x.itemId === l.itemId);
      if (!r || r.quantity + r.damaged > l.quantity)
        throw new BusinessRuleError(
          "INVALID_RECEIPT",
          "Received plus damaged cannot exceed ordered quantity",
        );
      discrepancy ||= r.quantity + r.damaged !== l.quantity || r.damaged > 0;
      await moveStock(
        tx,
        actor,
        l.itemId,
        o.toCenterId,
        r.quantity,
        "CENTER_INWARD",
        o.id,
        r.damaged,
      );
      await tx.centerOrderLine.update({
        where: { id: l.id },
        data: { receivedQuantity: r.quantity, damagedQuantity: r.damaged },
      });
    }
    const result = await tx.centerOrder.update({
      where: { id: o.id },
      data: {
        status: discrepancy ? "DISCREPANCY" : "RECEIVED",
        receivedAt: new Date(),
      },
    });
    await audit(tx, actor, "CENTER_RECEIVED", "CenterOrder", o.id, result);
    return result;
  });
}

export async function createRequisition(
  actor: string,
  b: z.infer<typeof requisitionSchema>,
) {
  return transaction(async (tx) => {
    await tx.center.findUniqueOrThrow({ where: { id: b.centerId } });
    const lines = [];
    for (const l of b.lines) {
      const item = await tx.inventoryItem.findUniqueOrThrow({
        where: { id: l.itemId },
      });
      lines.push({ ...l, unitCost: item.unitCost });
    }
    const result = await tx.printRequisition.create({
      data: {
        centerId: b.centerId,
        vendor: b.vendor,
        createdById: actor,
        lines: { create: lines },
      },
      include: { lines: true },
    });
    await audit(
      tx,
      actor,
      "PRINT_ORDERED",
      "PrintRequisition",
      result.id,
      result,
    );
    return result;
  });
}
export async function receiveRequisition(
  actor: string,
  requisitionId: string,
  b: z.infer<typeof receiptSchema>,
) {
  return transaction(async (tx) => {
    const o = await tx.printRequisition.findUniqueOrThrow({
      where: { id: requisitionId },
      include: { lines: true },
    });
    if (o.status === "RECEIVED")
      throw new BusinessRuleError(
        "ALREADY_RECEIVED",
        "Requisition has been fully received",
      );
    for (const r of b.lines) {
      const l = o.lines.find((x) => x.itemId === r.itemId);
      if (
        !l ||
        r.quantity + r.damaged <= 0 ||
        r.quantity + r.damaged > l.quantity - l.receivedQuantity
      )
        throw new BusinessRuleError(
          "INVALID_RECEIPT",
          "Receipt exceeds outstanding order or is empty",
        );
      await moveStock(
        tx,
        actor,
        l.itemId,
        o.centerId,
        r.quantity,
        "VENDOR_INWARD",
        o.id,
        r.damaged,
      );
      await tx.printRequisitionLine.update({
        where: { id: l.id },
        data: { receivedQuantity: { increment: r.quantity + r.damaged } },
      });
    }
    const remaining = await tx.printRequisitionLine.findMany({
      where: { requisitionId: o.id },
    });
    const result = await tx.printRequisition.update({
      where: { id: o.id },
      data: {
        status: remaining.every((l) => l.receivedQuantity === l.quantity)
          ? "RECEIVED"
          : "PART_RECEIVED",
      },
    });
    await audit(tx, actor, "VENDOR_RECEIVED", "PrintRequisition", o.id, result);
    return result;
  });
}
