import "dotenv/config";
import { z } from "zod";

const isTest =
  process.env.NODE_ENV === "test" ||
  process.env.npm_lifecycle_event === "test" ||
  Boolean(process.env.TEST);

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);
const optionalKey = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(32).optional(),
);

const envSchema = z.object({
  DATABASE_URL: isTest
    ? z
        .string()
        .url()
        .default(
          "postgresql://postgres:integration-only@localhost:5432/elms_ci?schema=public",
        )
    : z.string().url(),
  JWT_ACCESS_SECRET: isTest
    ? z
        .string()
        .min(32)
        .default("ci-integration-access-secret-32-characters")
    : z.string().min(32),
  JWT_REFRESH_SECRET: isTest
    ? z
        .string()
        .min(32)
        .default("ci-integration-refresh-secret-32-characters")
    : z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  ADMISSIONS_API_KEY: optionalKey,
  FINANCE_API_KEY: optionalKey,
  INTEGRATION_ACTOR_EMAIL: z.string().email().optional(),
  SMTP_HOST: optionalText,
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: optionalText,
  SMTP_PASSWORD: optionalText,
  SMTP_FROM: optionalText,
  TWILIO_ACCOUNT_SID: optionalText,
  TWILIO_AUTH_TOKEN: optionalText,
  TWILIO_FROM: optionalText,
  TWILIO_WHATSAPP_FROM: optionalText,
});

export const env = envSchema.parse(process.env);
