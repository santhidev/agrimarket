import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";
import {
  createKycSubmissionSchema,
  canSubmitKyc,
  KycStatus,
} from "@agrimarket/shared";
import {
  KYC_SUBMISSION_SELECT,
  mapKycSubmission,
  type KycSubmissionRow,
} from "@/app/api/kyc/mapping";

// GET /api/kyc — the current user's own KYC submissions, newest first.
// Anonymous → 401. The RLS policy (user_id = auth.uid()) enforces ownership at
// the DB layer too.
export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await createInsForgeServerClient();
  const { data, error } = await client.database
    .from("kyc_submissions")
    .select(KYC_SUBMISSION_SELECT)
    .eq("user_id", current.id)
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load KYC submissions" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as KycSubmissionRow[];
  return NextResponse.json({ submissions: rows.map(mapKycSubmission) });
}

// POST /api/kyc — submit a new KYC submission.
//
// Authenticated users only; user_id is pinned to the current user (the INSERT
// RLS policy rejects any mismatch). The client uploads both photos to Storage
// first and posts the resulting url+key pairs (see createKycSubmissionSchema).
//
// A user may only submit when unverified (None) or last rejected — a Pending
// user must wait for the admin to resolve their in-flight submission, and an
// Approved user is already verified. The check runs against the headline
// profiles.kyc_status, and the same row is flipped to Pending on success.
export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canSubmitKyc(current.kycStatus as KycStatus)) {
    const reason =
      current.kycStatus === KycStatus.Pending
        ? "คุณมีคำขอ KYC รอตรวจสอบอยู่แล้ว"
        : "คุณได้รับการยืนยันตัวตนแล้ว";
    return NextResponse.json({ error: reason }, { status: 409 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createKycSubmissionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid KYC submission", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { idCardPhoto, selfie } = parsed.data;
  const client = await createInsForgeServerClient();

  // Insert the submission first; if it succeeds, flip the headline status. The
  // INSERT runs as the owner (RLS user_id = auth.uid()).
  const { data, error } = await client.database
    .from("kyc_submissions")
    .insert([
      {
        user_id: current.id,
        id_card_photo_url: idCardPhoto.url,
        id_card_photo_key: idCardPhoto.key,
        selfie_url: selfie.url,
        selfie_key: selfie.key,
      },
    ])
    .select(KYC_SUBMISSION_SELECT)
    .limit(1);

  if (error) {
    return NextResponse.json(
      { error: "Failed to submit KYC" },
      { status: 500 }
    );
  }

  const row = (data?.[0] as KycSubmissionRow | undefined) ?? null;
  if (!row) {
    return NextResponse.json(
      { error: "Failed to submit KYC" },
      { status: 500 }
    );
  }

  // Flip the headline profile status to Pending. The profiles_update_own +
  // profiles_update_admin policies allow this (owner updating own row).
  const { error: profileErr } = await client.database
    .from("profiles")
    .update({ kyc_status: KycStatus.Pending })
    .eq("id", current.id);

  if (profileErr) {
    // The submission was created; the profile flip is best-effort bookkeeping.
    // Surface a 500 so the caller knows to retry/review, but the submission is
    // already persisted and the admin queue will still see it.
    return NextResponse.json(
      {
        error: "KYC submitted but profile status failed to update",
        submission: mapKycSubmission(row),
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { submission: mapKycSubmission(row) },
    { status: 201 }
  );
}
