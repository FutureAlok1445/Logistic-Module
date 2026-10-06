import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { BusinessRuleError } from "../../shared/errors";

export type Tx = Prisma.TransactionClient;
export async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
        maxWait: 10000,
        timeout: 60000,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034" &&
        attempt < 2
      )
        continue;
      throw e;
    }
  }
  throw new BusinessRuleError("BUSY", "Concurrent update; retry operation");
}
export async function audit(
  tx: Tx,
  employeeId: string,
  action: string,
  entity: string,
  entityId: string,
  after?: unknown,
) {
  await tx.auditLog.create({
    data: {
      employeeId,
      action,
      entity,
      entityId,
      after: after == null ? undefined : JSON.parse(JSON.stringify(after)),
    },
  });
}
export async function moveStock(
  tx: Tx,
  employeeId: string,
  itemId: string,
  centerId: string,
  quantity: number,
  reason: string,
  reference?: string,
  damaged = 0,
) {
  const [item, center] = await Promise.all([
    tx.inventoryItem.findUnique({ where: { id: itemId } }),
    tx.center.findUnique({ where: { id: centerId } }),
  ]);
  if (!item || !center)
    throw new BusinessRuleError("INVALID_STOCK", "Unknown item or centre");
  await tx.stock.upsert({
    where: { itemId_centerId: { itemId, centerId } },
    create: { itemId, centerId },
    update: {},
  });
  const changed = await tx.stock.updateMany({
    where: {
      itemId,
      centerId,
      ...(quantity < 0 ? { quantity: { gte: -quantity } } : {}),
    },
    data: {
      quantity: { increment: quantity },
      damaged: { increment: damaged },
    },
  });
  if (changed.count !== 1)
    throw new BusinessRuleError(
      "INSUFFICIENT_STOCK",
      `Insufficient stock for ${item.name}`,
    );
  await tx.stockMovement.create({
    data: {
      employeeId,
      itemId,
      centerId,
      quantity,
      damaged,
      reason,
      reference,
    },
  });
}
