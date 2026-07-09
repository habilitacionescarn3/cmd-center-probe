process.env.TZ = "America/Sao_Paulo";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://user:password@localhost:5432/status_page?schema=public";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "test-secret";
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "client";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "secret";
