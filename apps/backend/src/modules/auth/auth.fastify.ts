import { FastifyInstance } from "fastify";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { hashPassword, verifyPassword } from "../../shared/utils/crypto.utils";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../shared/utils/jwt.utils";
import { AppError } from "../../shared/errors";
import { protect, ok } from "../../http";
import { audit, transaction } from "../logistics/transaction";

const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const publicUser = (e: {
  id: string;
  fullName: string;
  role: string;
  email: string;
}) => ({ id: e.id, name: e.fullName, role: e.role, email: e.email });
const password = z.string().min(12).max(128);
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/v1/auth",
  maxAge: 7 * 86400,
};

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/login",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const body = z
        .object({
          email: z.string().trim().toLowerCase().email(),
          password: z.string().min(1).max(128),
        })
        .parse(req.body);
      const employee = await prisma.employee.findUnique({
        where: { email: body.email },
      });
      const valid = await verifyPassword(
        body.password,
        employee?.passwordHash ??
          "$2b$12$cHrFS5dzHgGWetjwH2HK8.xmqszqtuqnRbOVzS.l/QynGnR.xB9zG",
      );
      if (!employee?.isActive || !valid) {
        app.log.warn(
          {
            event: "LOGIN_FAILED",
            identityHash: digest(body.email),
            ip: req.ip,
          },
          "Login rejected",
        );
        throw new AppError(
          401,
          "INVALID_CREDENTIALS",
          "Invalid email or password",
        );
      }
      const sessionId = randomUUID();
      const refreshToken = signRefreshToken({ id: employee.id, sessionId });
      await transaction(async (tx) => {
        await tx.session.create({
          data: {
            id: sessionId,
            employeeId: employee.id,
            token: digest(refreshToken),
            userAgent: req.headers["user-agent"]?.slice(0, 500),
            expiresAt: new Date(Date.now() + 7 * 86400000),
          },
        });
        await audit(tx, employee.id, "LOGIN", "Session", sessionId);
      });
      reply.setCookie("elms_refresh", refreshToken, cookieOptions);
      return ok({
        user: publicUser(employee),
        accessToken: signAccessToken({
          id: employee.id,
          role: employee.role,
          sessionId,
        }),
      });
    },
  );

  app.post("/refresh", async (req, reply) => {
    const token = req.cookies.elms_refresh;
    if (!token) throw new AppError(401, "NO_SESSION", "Sign in to continue");
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new AppError(401, "INVALID_TOKEN", "Session expired");
    }
    const result = await transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id: payload.sessionId },
        include: { employee: true },
      });
      if (
        !session ||
        session.token !== digest(token) ||
        session.employeeId !== payload.id ||
        session.expiresAt <= new Date() ||
        !session.employee.isActive
      )
        throw new AppError(401, "INVALID_SESSION", "Session expired");
      // Rotate refresh token; the session lifetime stays fixed at seven days.
      const refreshToken = signRefreshToken({
        id: session.employeeId,
        sessionId: session.id,
      });
      await tx.session.update({
        where: { id: session.id },
        data: { token: digest(refreshToken) },
      });
      return { session, refreshToken };
    });
    reply.setCookie("elms_refresh", result.refreshToken, {
      ...cookieOptions,
      maxAge: Math.max(
        0,
        Math.floor((result.session.expiresAt.getTime() - Date.now()) / 1000),
      ),
    });
    return ok({
      user: publicUser(result.session.employee),
      accessToken: signAccessToken({
        id: result.session.employeeId,
        role: result.session.employee.role,
        sessionId: result.session.id,
      }),
    });
  });

  app.post("/logout", async (req, reply) => {
    if (req.cookies.elms_refresh)
      await prisma.session.deleteMany({
        where: { token: digest(req.cookies.elms_refresh) },
      });
    reply.clearCookie("elms_refresh", cookieOptions);
    return ok({ loggedOut: true });
  });
  app.get("/me", { preHandler: protect(app) }, async (req) =>
    ok(
      publicUser(
        await prisma.employee.findUniqueOrThrow({
          where: { id: req.employee.id },
        }),
      ),
    ),
  );
  app.get("/sessions", { preHandler: protect(app) }, async (req) =>
    ok(
      await prisma.session.findMany({
        where: { employeeId: req.employee.id },
        select: { id: true, createdAt: true, expiresAt: true, userAgent: true },
        orderBy: { createdAt: "desc" },
      }),
    ),
  );
  app.delete("/sessions/:id", { preHandler: protect(app) }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return ok(
      await prisma.session.deleteMany({
        where: { id, employeeId: req.employee.id },
      }),
    );
  });
  app.post("/change-password", { preHandler: protect(app) }, async (req) => {
    const b = z
      .object({ oldPassword: z.string().max(128), newPassword: password })
      .parse(req.body);
    const e = await prisma.employee.findUniqueOrThrow({
      where: { id: req.employee.id },
    });
    if (!(await verifyPassword(b.oldPassword, e.passwordHash)))
      throw new AppError(
        400,
        "INVALID_PASSWORD",
        "Current password is incorrect",
      );
    const passwordHash = await hashPassword(b.newPassword);
    await transaction(async (tx) => {
      await tx.employee.update({ where: { id: e.id }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { employeeId: e.id } });
      await audit(tx, e.id, "PASSWORD_CHANGED", "Employee", e.id);
    });
    return ok({ changed: true });
  });
  app.post(
    "/forgot-password",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (req) => {
      const { email } = z
        .object({ email: z.string().trim().toLowerCase().email() })
        .parse(req.body);
      if (!env.SMTP_HOST || !env.SMTP_FROM)
        throw new AppError(
          503,
          "EMAIL_NOT_CONFIGURED",
          "Email recovery is unavailable. Contact your administrator.",
        );
      const e = await prisma.employee.findUnique({ where: { email } });
      if (e?.isActive) {
        const token = randomBytes(32).toString("hex");
        await prisma.passwordReset.create({
          data: {
            employeeId: e.id,
            tokenHash: digest(token),
            expiresAt: new Date(Date.now() + 1800000),
          },
        });
        const transport = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: env.SMTP_USER
            ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
            : undefined,
        });
        await transport.sendMail({
          from: env.SMTP_FROM,
          to: e.email,
          subject: "Reset your ELMS password",
          text: `Reset within 30 minutes: ${env.FRONTEND_URL}/login?reset=${token}`,
        });
      }
      return ok({
        message: "If this employee exists, a reset link has been emailed.",
      });
    },
  );
  app.post("/reset-password", async (req) => {
    const b = z
      .object({ token: z.string().length(64), password })
      .parse(req.body);
    const passwordHash = await hashPassword(b.password);
    await transaction(async (tx) => {
      const reset = await tx.passwordReset.findUnique({
        where: { tokenHash: digest(b.token) },
        include: { employee: true },
      });
      if (
        !reset ||
        reset.usedAt ||
        reset.expiresAt <= new Date() ||
        !reset.employee.isActive
      )
        throw new AppError(
          400,
          "INVALID_RESET",
          "Reset link expired or already used",
        );
      await tx.passwordReset.updateMany({
        where: { employeeId: reset.employeeId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.employee.update({
        where: { id: reset.employeeId },
        data: { passwordHash },
      });
      await tx.session.deleteMany({ where: { employeeId: reset.employeeId } });
      await audit(
        tx,
        reset.employeeId,
        "PASSWORD_RESET",
        "Employee",
        reset.employeeId,
      );
    });
    return ok({ changed: true });
  });
}
