import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { requireAdmin } from "@/app/lib/require-admin";
import { rejectKycSubmissionSchema, KycStatus } from "@agrimarket/shared";
import {
  KYC_SUBMISSION_SELECT,
  mapKycSubmission,
  type KycSubmissionRow,
} from "@/app/api/kyc/mapping";

// POST /api/admin/kyc/:id/reject — admin only.
//
// Sets the submission to REJECTED and stores the mandatory rejection reason,
// and flips the submitter's headline profiles.kyc_status to REJECTED so they
// may resubmit (canSubmitKyc allows Rejected). Double-reject is a 409 (the
// submission is no longer PENDING). Mirrors the #05 reject pattern.
export async function POST(
  request: Request,
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
  const json = await request.json().catch(() => null);
  const parsed = rejectKycSubmissionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid rejection", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const client = await createInsForgeServerClient();

  // Load first to distinguish 404 from 409. .single() returns BOTH an error
  // (PGRST116) and null data when 0 rows match, so a missing id reaches here as
  // an error — treat that as 404, not 500.
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
      status: "REJECTED",
      rejection_reason: parsed.data.rejectionReason,
      reviewed_by: gate.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(KYC_SUBMISSION_SELECT)
    .single();

  if (updErr) {
    return NextResponse.json(
      { error: "Failed to reject KYC submission" },
      { status: 500 }
    );
  }

  // Flip the submitter's headline status to Rejected (resubmit allowed).
  const { error: profileErr } = await client.database
    .from("profiles")
    .update({ kyc_status: KycStatus.Rejected })
    .eq("id", current.user_id);

  if (profileErr) {
    return NextResponse.json(
      { error: "KYC rejected but profile status failed to update" },
      { status: 500 }
    );
  }

  const row = updated as KycSubmissionRow | null;
  return NextResponse.json({
    submission: row ? mapKycSubmission(row) : null,
  });
}
