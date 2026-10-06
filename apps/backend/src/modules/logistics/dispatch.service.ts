import { DispatchStatus } from "@prisma/client";
import { z } from "zod";
import { BusinessRuleError, NotFoundError } from "../../shared/errors";
import { addressErrors, assertTransition } from "./domain";
import { audit, transaction, Tx } from "./transaction";
import { dispatchSchema } from "./schemas";
import { packDispatches } from "./packing.service";

export const pendingStatuses: DispatchStatus[] = [
  "QUEUED",
  "ADDRESS_FLAGGED",
  "PACKED",
  "HOLD",
];
export async function notify(
  tx: Tx,
  studentId: string,
  event: string,
  dispatchId?: string,
) {
  const template = await tx.notificationTemplate.findUnique({
    where: { event },
  });
  if (!template?.enabled) return;
  const student = await tx.student.findUniqueOrThrow({
    where: { id: studentId },
    include: { course: true },
  });
  const dispatch = await tx.dispatch.findFirst({
    where: { studentId, ...(dispatchId ? { id: dispatchId } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { kit: true, courierPartner: true },
  });
  const vars: Record<string, string> = {
    Name: student.name,
    Course: student.course.name,
    Kit: dispatch?.kit.name ?? "",
    Courier: dispatch?.courierPartner?.name ?? "",
    AWB: dispatch?.awbNumber ?? "",
    Date:
      dispatch?.expectedDelivery?.toISOString().slice(0, 10) ??
      "to be confirmed",
  };
  const content = template.content.replace(
    /\[([A-Za-z]+)\]/g,
    (all, key) => vars[key] ?? all,
  );
  await tx.notificationLog.create({
    data: {
      studentId,
      type: event,
      channel: template.channel,
      content,
      status: "PENDING",
    },
  });
}

export async function eligibility(tx: Tx, studentId: string, kitId: string) {
  const student = await tx.student.findUnique({
    where: { id: studentId },
    include: { milestoneStatus: true },
  });
  const kit = await tx.kit.findUnique({ where: { id: kitId } });
  if (!student || !kit) throw new NotFoundError("Student or kit");
  if (student.status !== "ACTIVE" || student.courseId !== kit.courseId)
    throw new BusinessRuleError(
      "BR-03",
      "Student is inactive, on hold or in a different course",
    );
  if (
    await tx.transfer.count({
      where: {
        studentId,
        status: { in: ["PENDING", "APPROVED_AWAITING_SYNC"] },
      },
    })
  )
    throw new BusinessRuleError(
      "BR-04",
      "Transfer must be resolved before packing",
    );
  if (
    !student.milestoneStatus.some(
      (m) => m.milestoneNumber === kit.milestoneNumber && m.paid,
    )
  )
    throw new BusinessRuleError(
      "BR-01",
      "Required payment milestone is not cleared",
    );
  const postcode = await tx.pincode.findUnique({
    where: { code: student.pincode },
  });
  const errors = addressErrors(student, postcode);
  if (errors.length) throw new BusinessRuleError("BR-07", errors.join("; "));
  return student;
}

export async function rebuildQueue(
  tx: Tx,
  actor: string,
  studentIds?: string[],
) {
  const students = await tx.student.findMany({
    where: studentIds ? { id: { in: studentIds } } : {},
    include: {
      milestoneStatus: true,
      dispatches: true,
      transfers: {
        where: { status: { in: ["PENDING", "APPROVED_AWAITING_SYNC"] } },
      },
    },
  });
  const kits = await tx.kit.findMany({ include: { items: true } });
  const postcodes = new Map(
    (await tx.pincode.findMany()).map((p) => [p.code, p]),
  );
  const rules = await tx.courierRule.findMany({ orderBy: { priority: "asc" } });
  let created = 0;
  for (const student of students) {
    const blocked = student.status !== "ACTIVE" || student.transfers.length > 0;
    for (const d of student.dispatches.filter((d) =>
      pendingStatuses.includes(d.status),
    )) {
      const kit = kits.find((k) => k.id === d.kitId);
      const paid =
        !!kit &&
        student.milestoneStatus.some(
          (m) => m.milestoneNumber === kit.milestoneNumber && m.paid,
        );
      if (blocked || !paid || kit?.courseId !== student.courseId) {
        if (d.status !== "HOLD") {
          await tx.dispatch.update({
            where: { id: d.id },
            data: { status: "HOLD" },
          });
          await tx.trackingEvent.create({
            data: {
              dispatchId: d.id,
              status: "HOLD",
              reason: "Eligibility revoked by authoritative data",
            },
          });
        }
      }
    }
    if (blocked) continue;
    for (const kit of kits.filter(
      (k) =>
        k.courseId === student.courseId &&
        k.items.length &&
        student.milestoneStatus.some(
          (m) => m.milestoneNumber === k.milestoneNumber && m.paid,
        ),
    )) {
      if (
        student.dispatches.some(
          (d) =>
            d.kitId === kit.id &&
            d.enrollmentVersion === student.enrollmentVersion,
        )
      )
        continue;
      const flags = addressErrors(student, postcodes.get(student.pincode));
      const rule = rules.find(
        (r) => r.state.toLowerCase() === student.state.toLowerCase(),
      );
      const d = await tx.dispatch.create({
        data: {
          studentId: student.id,
          kitId: kit.id,
          enrollmentVersion: student.enrollmentVersion,
          status: flags.length ? "ADDRESS_FLAGGED" : "QUEUED",
          deliveryMode: "COURIER",
          courierPartnerId: rule?.courierPartnerId,
          createdById: actor,
        },
      });
      await tx.trackingEvent.create({
        data: {
          dispatchId: d.id,
          status: d.status,
          reason: flags.join("; ") || "Milestone cleared",
        },
      });
      created++;
    }
  }
  await audit(tx, actor, "QUEUE_RECONCILED", "Dispatch", "queue", {
    created,
    students: students.length,
  });
  return { created };
}

export async function transitionDispatch(
  actor: string,
  input: z.infer<typeof dispatchSchema>,
  canApprove: boolean,
) {
  return transaction(async (tx) => {
    const ids = [...new Set(input.ids)];
    if (input.awbNumber && ids.length !== 1)
      throw new BusinessRuleError(
        "AWB_UNIQUE",
        "Enter one unique AWB per shipment",
      );
    if (input.status === "PACKED") return packDispatches(tx, actor, input);
    for (const dispatchId of ids) {
      const d = await tx.dispatch.findUnique({
        where: { id: dispatchId },
        include: { kit: { include: { items: { include: { item: true } } } } },
      });
      if (!d) throw new NotFoundError("Dispatch");
      assertTransition(d.status, input.status);
      const data: Record<string, unknown> = { status: input.status };
      if (input.deliveryMode) data.deliveryMode = input.deliveryMode;
      if (["QUEUED", "PACKED", "HANDED_TO_COURIER"].includes(input.status)) {
        const student = await eligibility(tx, d.studentId, d.kitId);
        if (d.enrollmentVersion !== student.enrollmentVersion)
          throw new BusinessRuleError(
            "STALE_ENROLLMENT",
            "Dispatch belongs to a previous enrolment",
          );
        if (input.status === "QUEUED" && d.packedItems)
          throw new BusinessRuleError(
            "ALREADY_PACKED",
            "Packed shipment must resume handover without packing again",
          );
      }
      if (
        input.courierPartnerId &&
        input.courierPartnerId !== d.courierPartnerId
      ) {
        if (!input.reason || input.reason.trim().length < 5)
          throw new BusinessRuleError(
            "BR-06",
            "Courier override requires a reason",
          );
        Object.assign(data, {
          courierPartnerId: input.courierPartnerId,
          overrideReason: input.reason,
        });
      }
      if (input.status === "HANDED_TO_COURIER") {
        if (!canApprove)
          throw new BusinessRuleError(
            "APPROVAL_REQUIRED",
            "Manager approval is required for handover",
          );
        if (!d.packedItems)
          throw new BusinessRuleError(
            "NOT_PACKED",
            "Pack shipment before handover",
          );
        const mode = input.deliveryMode ?? d.deliveryMode;
        if (mode !== "IN_PERSON" && !input.awbNumber && !d.awbNumber)
          throw new BusinessRuleError(
            "AWB_REQUIRED",
            "Tracking number required",
          );
        if (
          mode === "COURIER" &&
          !input.courierPartnerId &&
          !d.courierPartnerId
        )
          throw new BusinessRuleError(
            "COURIER_REQUIRED",
            "Configure courier routing or choose a courier with an override reason",
          );
        Object.assign(data, {
          awbNumber: input.awbNumber ?? d.awbNumber,
          dispatchedAt: new Date(),
          approvedById: actor,
        });
      }
      if (input.status === "DELIVERED") data.deliveredAt = new Date();
      if (input.expectedDelivery)
        data.expectedDelivery = new Date(input.expectedDelivery);
      if (input.expectedDispatch)
        data.expectedDispatch = new Date(input.expectedDispatch);
      if (
        ["FAILED_DELIVERY", "HOLD", "RTO_INITIATED"].includes(input.status) &&
        !input.reason?.trim()
      )
        throw new BusinessRuleError(
          "REASON_REQUIRED",
          "Enter the exception reason",
        );
      await tx.dispatch.update({ where: { id: d.id }, data });
      await tx.trackingEvent.create({
        data: {
          dispatchId: d.id,
          status: input.status,
          location: input.location,
          reason: input.reason,
        },
      });
      await audit(tx, actor, "STATUS_CHANGED", "Dispatch", d.id, {
        from: d.status,
        to: input.status,
        reason: input.reason,
      });
      await notify(tx, d.studentId, input.status, d.id);
    }
    return { updated: ids.length };
  });
}
