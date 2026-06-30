import { NextResponse } from "next/server";
import { prisma } from "@agrimarket/database";

// Smoke route: proves the Next.js app + Prisma + Postgres wiring works.
// GET /api/health -> { ok: true, db: <true if Postgres reachable> }
export async function GET() {
  let db = false;
  try {
    // A trivial query that forces a real round-trip to Postgres.
    await prisma.user.count();
    db = true;
  } catch {
    db = false;
  }

  return NextResponse.json({ ok: true, db });
}
