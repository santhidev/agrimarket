import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";

// Smoke route: proves the Next.js app + InsForge wiring works.
// GET /api/health -> { ok: true, db: <true if InsForge reachable> }
export async function GET() {
  let db = false;
  try {
    const client = await createInsForgeServerClient();
    const { error } = await client.database
      .from("users")
      .select("id", { count: "exact", head: true });
    db = !error;
  } catch {
    db = false;
  }

  return NextResponse.json({ ok: true, db });
}
