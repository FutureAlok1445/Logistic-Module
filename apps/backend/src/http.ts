import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "./config/database";
import { verifyAccessToken } from "./shared/utils/jwt.utils";
import { hasPermission } from "./shared/constants/permissions";
import { AppError } from "./shared/errors";

declare module "fastify" {
  interface FastifyRequest {
    employee: { id: string; role: string; sessionId: string };
  }
}
export function protect(app: FastifyInstance, permission?: string) {
  return async (req: FastifyRequest) => {
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token)
      throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue");
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(
        401,
        "INVALID_TOKEN",
        "Session expired; sign in again",
      );
    }
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { employee: true },
    });
    if (
      !session ||
      session.employeeId !== payload.id ||
      session.expiresAt <= new Date() ||
      !session.employee.isActive
    )
      throw new AppError(401, "SESSION_REVOKED", "Session is no longer active");
    req.employee = {
      id: session.employeeId,
      role: session.employee.role,
      sessionId: session.id,
    };
    if (permission && !hasPermission(req.employee.role, permission))
      throw new AppError(
        403,
        "FORBIDDEN",
        "Your role cannot perform this action",
      );
  };
}
export const ok = (data: unknown) => ({ success: true, data });
