import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { transaction, audit } from "./transaction";
import { providerActor } from "./ingestion";

export async function purgeExpiredPII() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "piiRetentionYears" },
  });
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - Number(setting?.value ?? 3));
  const students = await prisma.student.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { lt: cutoff },
      name: { not: "Archived student" },
    },
    select: { id: true },
    take: 1000,
  });
  if (students.length) {
    const actor = await providerActor();
    await transaction(async (tx) => {
      const ids = students.map((s) => s.id);
      await tx.student.updateMany({
        where: { id: { in: ids } },
        data: {
          name: "Archived student",
          mobile: "",
          email: null,
          address: "",
          city: "",
          state: "",
          pincode: "",
          notes: null,
        },
      });
      await tx.dispatch.updateMany({
        where: { studentId: { in: ids } },
        data: { addressSnapshot: Prisma.JsonNull },
      });
      await tx.notificationLog.updateMany({
        where: { studentId: { in: ids } },
        data: { content: "Archived under retention policy" },
      });
      await audit(tx, actor, "PII_PURGED", "Student", "retention-batch", {
        count: ids.length,
      });
    });
  }
  await prisma.importBatch.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 86400000) } },
  });
  await prisma.passwordReset.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
