import { buildApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/database";
import { startNotificationWorker } from "./modules/logistics/notifications.worker";

async function main() {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: process.env.API_HOST || "0.0.0.0" });
  const stopWorker = startNotificationWorker();
  const shutdown = async () => {
    stopWorker();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
main().catch(() => {
  process.stderr.write(
    "ELMS startup failed. Check configuration and service availability.\n",
  );
  process.exit(1);
});
