import { env } from "../../config/env";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { purgeExpiredPII } from "./privacy";

export async function processNotifications() {
  await prisma.notificationLog.updateMany({
    where: { status: "SENDING", nextAttemptAt: { lt: new Date() } },
    data: { status: "PENDING" },
  });
  const pending = await prisma.notificationLog.findMany({
    where: {
      status: { in: ["PENDING", "WAITING_CONFIGURATION"] },
      nextAttemptAt: { lte: new Date() },
      attempts: { lt: 5 },
    },
    include: { student: { select: { mobile: true } } },
    take: 20,
    orderBy: { timestamp: "asc" },
  });
  for (const n of pending) {
    const from =
      n.channel === "WHATSAPP" ? env.TWILIO_WHATSAPP_FROM : env.TWILIO_FROM;
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !from) {
      await prisma.notificationLog.update({
        where: { id: n.id },
        data: {
          status: "WAITING_CONFIGURATION",
          error: "Configure messaging provider credentials",
          nextAttemptAt: new Date(Date.now() + 60000),
        },
      });
      continue;
    }
    const claim = await prisma.notificationLog.updateMany({
      where: { id: n.id, status: n.status },
      data: {
        status: "SENDING",
        attempts: { increment: 1 },
        nextAttemptAt: new Date(Date.now() + 120000),
      },
    });
    if (!claim.count) continue;
    try {
      const prefix = n.channel === "WHATSAPP" ? "whatsapp:" : "";
      const form = new URLSearchParams({
        From: from,
        To: `${prefix}+91${n.student.mobile}`,
        Body: n.content,
      });
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok)
        throw new Error(`Messaging provider returned HTTP ${response.status}`);
      const data = (await response.json()) as { sid: string };
      await prisma.notificationLog.update({
        where: { id: n.id },
        data: {
          status: "SENT",
          providerId: data.sid,
          sentAt: new Date(),
          error: null,
        },
      });
    } catch (error) {
      await prisma.notificationLog.update({
        where: { id: n.id },
        data: {
          status: n.attempts + 1 >= 5 ? "FAILED" : "PENDING",
          error:
            error instanceof Error &&
            error.message.startsWith("Messaging provider")
              ? error.message
              : "Messaging provider unavailable",
          nextAttemptAt: new Date(
            Date.now() + Math.pow(2, n.attempts + 1) * 60000,
          ),
        },
      });
    }
  }
}
export function startNotificationWorker() {
  let running = false;
  let nextRetentionRun = 0;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processNotifications();
      if (Date.now() >= nextRetentionRun) {
        await purgeExpiredPII();
        nextRetentionRun = Date.now() + 86400000;
      }
    } catch {
      logger.error(
        { event: "OUTBOX_FAILED" },
        "Notification outbox unavailable",
      );
    } finally {
      running = false;
    }
  }, 15000);
  timer.unref();
  return () => clearInterval(timer);
}
