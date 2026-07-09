import "server-only";

import { z } from "zod";

const serverSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .url("DATABASE_URL must be a valid URL"),
    NEXTAUTH_SECRET: z
      .string()
      .min(1, "NEXTAUTH_SECRET is required")
      .describe("Used to encrypt session data."),
    GOOGLE_CLIENT_ID: z
      .string()
      .optional()
      .describe("Google OAuth client id"),
    GOOGLE_CLIENT_SECRET: z
      .string()
      .optional()
      .describe("Google OAuth client secret"),
    SLACK_SIGNING_SECRET: z.string().optional(),
    SLACK_WEBHOOK_URL: z.string().url().optional(),
    JIRA_BASE_URL: z.string().url().optional(),
    JIRA_TOKEN: z.string().optional(),
    JIRA_PROJECT_KEY: z.string().optional(),
    NEXTAUTH_URL: z
      .string()
      .url("NEXTAUTH_URL must be a valid URL")
      .optional(),
    TZ: z.string().default("America/Sao_Paulo"),
  })
  .transform((env) => ({
    ...env,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || undefined,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || undefined,
    TZ: env.TZ ?? "America/Sao_Paulo",
  }));

export type ServerEnv = z.infer<typeof serverSchema>;

export const serverEnv = (() => {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "[env] Invalid server environment variables",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error("Invalid server environment variables");
  }
  return parsed.data;
})();

declare global {
  namespace NodeJS {
    interface ProcessEnv extends ServerEnv {}
  }
}
