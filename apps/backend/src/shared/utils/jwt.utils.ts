import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env";

export interface JwtPayload {
  id: string;
  role: string;
  sessionId: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: {
  id: string;
  sessionId?: string;
}): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions["expiresIn"],
    jwtid: randomUUID(),
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
  }) as JwtPayload;
}

export function verifyRefreshToken(token: string): {
  id: string;
  sessionId: string;
} {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ["HS256"],
  }) as { id: string; sessionId: string };
}
