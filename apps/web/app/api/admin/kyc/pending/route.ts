import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";
import {
  KYC_SUBMISSION_SELECT,
  mapKycSubmission,
  type KycSubmissionRow,
} from "@/app/api/kyc/mapping";

// GET /api/admin/kyc/pending — admin only.
//
// Returns PENDING submissions oldest-first (FIFO review queue), mirroring the
// product-suggestion pending endpoint from Issue 05.
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: gate.status }
    );
  }

  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("kyc_submissions")
    .select(KYC_SUBMISSION_SELECT)
    .eq("status", "PENDING")
    .order("submitted_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load pending KYC submissions" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as KycSubmissionRow[];
  return NextResponse.json({ submissions: rows.map(mapKycSubmission) });
}
