import { NextResponse } from "next/server";
import { createAdminClient } from "@agrimarket/database";

// Smoke route: proves the Next.js app + InsForge wiring works.
// GET /api/health -> { ok: true, db: <true if InsForge reachable> }
export async function GET() {
  let db = false;
  try {
    // auth.users is a managed InsForge table; a head count proves the DB is
    // reachable and the admin client credentials are valid.
    const client = createAdminClient();
    const { error } = await client.database
      .from("users")
      .select("id", { count: "exact", head: true });
    db = !error;
  } catch {
    db = false;
  }

  return NextResponse.json({ ok: true, db });
}
