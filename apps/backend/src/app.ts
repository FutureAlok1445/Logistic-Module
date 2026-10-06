import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "./config/env";
import { prisma } from "./config/database";
import { AppError } from "./shared/errors";
import { authRoutes } from "./modules/auth/auth.fastify";
import { logisticsRoutes } from "./modules/logistics/router";
import { integrationRoutes } from "./modules/logistics/ingestion";
import { importRoutes } from "./modules/logistics/imports";
import { reportRoutes } from "./modules/logistics/reports";
import { employeeWorkspaceRoutes } from "./modules/employee/workspace";

export async function buildApp() {
  const app = Fastify({
    bodyLimit: 10 * 1024 * 1024,
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.x-provider-key",
      ],
    },
    logController: new Fastify.LogController({ disableRequestLogging: true }),
  });
  await app.register(cors, { origin: env.FRONTEND_URL, credentials: true });
  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5, parts: 6 },
  });
  app.addHook("onRequest", async (req) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== env.FRONTEND_URL
    )
      throw new AppError(
        403,
        "INVALID_ORIGIN",
        "Request origin is not allowed",
      );
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.cookies.elms_refresh &&
      !req.headers.origin &&
      !req.headers.authorization
    )
      throw new AppError(
        403,
        "ORIGIN_REQUIRED",
        "Browser session requests require an origin",
      );
  });
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });
  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({
      success: false,
      code: "NOT_FOUND",
      message: "Endpoint not found",
    }),
  );
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError)
      return reply
        .code(error.statusCode)
        .send({ success: false, code: error.code, message: error.message });
    if (error instanceof ZodError)
      return reply.code(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        return reply.code(409).send({
          success: false,
          code: "DUPLICATE",
          message: "Record already exists or tracking number is in use",
        });
      if (error.code === "P2025")
        return reply.code(404).send({
          success: false,
          code: "NOT_FOUND",
          message: "Record not found",
        });
      if (["P2003", "P2014"].includes(error.code))
        return reply.code(422).send({
          success: false,
          code: "INVALID_REFERENCE",
          message: "Choose existing related records",
        });
    }
    const status = Number((error as { statusCode?: number }).statusCode);
    if (status >= 400 && status < 500)
      return reply.code(status).send({
        success: false,
        code: "REQUEST_REJECTED",
        message:
          status === 413
            ? "Maximum file size is 5 MB"
            : "Request rejected; check inputs or retry later",
      });
    app.log.error(
      {
        event: "REQUEST_FAILED",
        errorType: error instanceof Error ? error.name : "Unknown",
      },
      "Request failed",
    );
    return reply.code(500).send({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Operation failed. Retry or contact your administrator.",
    });
  });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(logisticsRoutes, { prefix: "/api/v1" });
  await app.register(integrationRoutes, { prefix: "/api/v1/integrations" });
  await app.register(importRoutes, { prefix: "/api/v1/imports" });
  await app.register(reportRoutes, { prefix: "/api/v1/reports" });
  await app.register(employeeWorkspaceRoutes, { prefix: "/api/v1" });
  return app;
}
