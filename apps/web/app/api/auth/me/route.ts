import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/get-profile";

// GET /api/auth/me -> { user: { id, phone, isAdmin } | null }
//
// Single source of truth for client-side auth state. The AuthProvider fetches
// this once on mount so TopNav and other client components don't each have to
// resolve the session themselves (which they can't from a Client Component
// anyway). Force-dynamic because the result depends on the request's cookies.
export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getCurrentUser();

  if (!current) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: current.id,
      phone: current.phone,
      isAdmin: current.isAdmin,
    },
  });
}
