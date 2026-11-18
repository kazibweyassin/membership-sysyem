import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/health
 *
 * Deployment diagnostics. Reports whether the app is configured and whether it
 * can reach the database, without exposing any secret values.
 *
 * Used to diagnose a fresh deployment (e.g. a Vercel build whose DATABASE_URL
 * is missing or points at a database with no tables).
 */
export async function GET(_req: NextRequest) {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV ?? null,
  };

  // --- Configuration presence (booleans only, never values) ---
  const config = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    JWT_SECRET: Boolean(process.env.JWT_SECRET),
    JWT_SECRET_is_placeholder:
      process.env.JWT_SECRET === "dev-secret-change-in-production-min-32-characters-long" ||
      process.env.JWT_SECRET === "dev-secret-change-in-production",
    CRON_SECRET: Boolean(process.env.CRON_SECRET),
    SMTP_HOST: Boolean(process.env.SMTP_HOST),
    STORAGE_DIR: process.env.STORAGE_DIR ?? null,
  };
  checks.config = config;

  // Flag a DATABASE_URL that points at the developer's own machine, which a
  // serverless function cannot reach.
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (dbUrl) {
    let host: string | null = null;
    try {
      host = new URL(dbUrl).hostname;
    } catch {
      host = null;
    }
    checks.database = {
      hostIsLocal: host ? ["localhost", "127.0.0.1", "::1"].includes(host) : null,
    };
  }

  // --- Database connectivity and schema state ---
  if (!process.env.DATABASE_URL) {
    checks.status = "error";
    checks.error =
      "DATABASE_URL is not set. Add it in your host's environment variables.";
    return Response.json(checks, { status: 500 });
  }

  try {
    const tables = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::text AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    await prisma.user.count({ take: 1 });

    checks.database = {
      ...(checks.database as object),
      reachable: true,
      publicTables: Number(tables[0]?.count ?? 0),
    };

    if (Number(tables[0]?.count ?? 0) === 0) {
      checks.status = "error";
      checks.error =
        "Database is reachable but empty. Apply migrations with `prisma migrate deploy` against this DATABASE_URL, then run the seed script.";
      return Response.json(checks, { status: 503 });
    }

    checks.status = "ok";
    return Response.json(checks, { status: 200 });
  } catch (error: any) {
    checks.status = "error";
    checks.error = error?.message?.split("\n")[0] ?? "Database query failed";
    checks.errorCode = error?.code ?? null;
    return Response.json(checks, { status: 503 });
  }
}