import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";
import { KycStatus } from "@agrimarket/shared";
import {
  KYC_SUBMISSION_SELECT,
  mapKycSubmission,
  type KycSubmissionRow,
} from "@/app/api/kyc/mapping";

// POST /api/admin/kyc/:id/approve — admin only.
//
// Marks the submission APPROVED with reviewer + timestamp, and flips the
// submitter's headline profiles.kyc_status to APPROVED so they may submit
// offers (#10). The submission must still be PENDING — reviewing it twice is a
// 409. Loads the row first to distinguish 404 (missing) from 409 (already
// reviewed); a filtered UPDATE matching nothing returns an empty row with no
// error (the #05 review-endpoint pattern).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: gate.status }
    );
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  // Load first to distinguish 404 from 409. Admin-visible (RLS bypass).
  // .single() returns BOTH an error (PGRST116) and null data when 0 rows match,
  // so a missing id reaches here as an error — treat that as 404, not 500.
  const { data: existing, error: findErr } = await client.database
    .from("kyc_submissions")
    .select(KYC_SUBMISSION_SELECT)
    .eq("id", id)
    .single();

  const current = existing as KycSubmissionRow | null;
  if (!current) {
    return NextResponse.json(
      { error: "KYC submission not found" },
      { status: 404 }
    );
  }
  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load KYC submission" },
      { status: 500 }
    );
  }
  if (current.status !== "PENDING") {
    return NextResponse.json(
      { error: `KYC submission already ${current.status}` },
      { status: 409 }
    );
  }

  const { data: updated, error: updErr } = await client.database
    .from("kyc_submissions")
    .update({
      status: "APPROVED",
      reviewed_by: gate.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(KYC_SUBMISSION_SELECT)
    .single();

  if (updErr) {
    return NextResponse.json(
      { error: "Failed to approve KYC submission" },
      { status: 500 }
    );
  }

  // Flip the submitter's headline status to Approved. The profiles_update_admin
  // policy (added in the #06 migration) lets an admin update another user's
  // row. A failure here leaves the submission APPROVED but the profile stale,
  // so surface a 500 — the operator can retry by re-approving (which 409s, but
  // the row is already correct) or fix the profile directly.
  const { error: profileErr } = await client.database
    .from("profiles")
    .update({ kyc_status: KycStatus.Approved })
    .eq("id", current.user_id);

  if (profileErr) {
    return NextResponse.json(
      { error: "KYC approved but profile status failed to update" },
      { status: 500 }
    );
  }

  const row = updated as KycSubmissionRow | null;
  return NextResponse.json({
    submission: row ? mapKycSubmission(row) : null,
  });
}
