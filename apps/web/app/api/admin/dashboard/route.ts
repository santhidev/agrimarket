import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/require-admin";
import { loadAdminDashboard } from "./load-dashboard";

// GET /api/admin/dashboard — the 5 platform-health metrics (Issue 18).
//
// Admin-only (requireAdmin). Delegates the count queries + rate math to
// loadAdminDashboard, which the /admin Server Component also calls directly.
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: gate.status }
    );
  }

  try {
    const snapshot = await loadAdminDashboard();
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error("[admin/dashboard] load failed", err);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
