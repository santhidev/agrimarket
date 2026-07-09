import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@insforge/sdk";
import { createInsForgeAdminClient } from "../../app/lib/insforge-admin";
import { INSFORGE, TEST, PRODUCT_NAME } from "./test-ids";
import { loginViaUi } from "../helpers/flow";

// globalSetup (Issue 19): provisions the 3 fixed test users + a product + the
// seller's KYC approval, then logs each user in via the real UI and persists
// their session as storageState files. The happy-path spec loads these files
// to skip re-login on every step.
//
// Idempotent: users are find-or-create via the OTP verify edge function, so a
// re-run after a prior successful setup is safe. The admin client sets
// is_admin on the admin user every run (idempotent UPDATE).

export default async function globalSetup(_config: FullConfig) {
  // 1. Ensure the server is up (the config has no webServer auto-start).
  await waitForServer();

  // 2. Ensure each user exists (find-or-create via OTP verify edge function).
  for (const role of ["buyer", "seller", "admin"] as const) {
    await ensureUser(TEST[role].phone);
  }

  // 3. Bootstrap the admin: set is_admin = true via the service-role client.
  await bootstrapAdmin(TEST.admin.phone);

  // 4. Ensure a product + grade exist for the demand.
  const product = await ensureProduct();

  // 5. Ensure the seller's KYC is Approved.
  await ensureSellerKyc();

  // 6. Log in each user via the UI + persist storageState.
  await mkdir(dirname(TEST.buyer.storageState), { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const role of ["buyer", "seller", "admin"] as const) {
      const context = await browser.newContext({
        baseURL: INSFORGE.baseURL,
      });
      const page = await context.newPage();
      await loginViaUi(page, TEST[role].phone);
      await context.storageState({ path: TEST[role].storageState });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  // Stash the product id for the spec via env vars (globalSetup can't return
  // data directly to specs; env is the simple bridge).
  process.env.E2E_PRODUCT_ID = product.id;
  process.env.E2E_PRODUCT_GRADE_ID = product.gradeId;
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${INSFORGE.baseURL}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${INSFORGE.baseURL} did not become healthy in 60s`);
}

// Find-or-create a user by requesting + verifying an OTP. The verify edge
// function find-or-creates the auth.users + profiles row.
async function ensureUser(phone: string): Promise<void> {
  const client = createClient({
    baseUrl: INSFORGE.url,
    anonKey: INSFORGE.anonKey,
  });
  const { data: reqData, error: reqErr } = await client.functions.invoke(
    "phone-otp",
    { body: { action: "request", phone } }
  );
  if (reqErr) throw new Error(`OTP request failed for ${phone}: ${reqErr.message}`);
  const code = (reqData as { testCode?: string }).testCode;
  if (!code) throw new Error(`No testCode for ${phone}`);

  const { error: verifyErr } = await client.functions.invoke("phone-otp", {
    body: { action: "verify", phone, code },
  });
  if (verifyErr) throw new Error(`OTP verify failed for ${phone}: ${verifyErr.message}`);
}

async function bootstrapAdmin(phone: string): Promise<void> {
  const admin = createInsForgeAdminClient();
  const { data: profiles, error: findErr } = await admin.database
    .from("profiles")
    .select("id, phone")
    .eq("phone", phone);
  if (findErr) throw new Error(`admin bootstrap find failed: ${findErr.message}`);
  const profile = (profiles as unknown as { id: string }[] | null)?.[0];
  if (!profile) throw new Error(`admin profile not found for ${phone}`);
  const { error: updErr } = await admin.database
    .from("profiles")
    .update({ is_admin: true })
    .eq("id", profile.id);
  if (updErr) throw new Error(`admin bootstrap update failed: ${updErr.message}`);
}

async function ensureProduct(): Promise<{ id: string; gradeId: string }> {
  const admin = createInsForgeAdminClient();
  const { data: existing } = await admin.database
    .from("products")
    .select("id, name")
    .eq("name", PRODUCT_NAME);
  let productId: string;
  const prod = (existing as unknown as { id: string }[] | null)?.[0];
  if (prod) {
    productId = prod.id;
  } else {
    const { data: created, error: createErr } = await admin.database
      .from("products")
      .insert([
        {
          name: PRODUCT_NAME,
          category: "ผลไม้",
          unit: "กก.",
          requires_cold_chain: false,
          is_fragile: false,
          shelf_life_hours: 168,
          is_stackable: false,
        },
      ])
      .select("id")
      .limit(1);
    if (createErr || !created?.length)
      throw new Error(`product create failed: ${createErr?.message}`);
    productId = (created as unknown as { id: string }[])[0].id;
  }

  const { data: grades } = await admin.database
    .from("product_grades")
    .select("id")
    .eq("product_id", productId);
  let gradeId: string;
  const grade = (grades as unknown as { id: string }[] | null)?.[0];
  if (grade) {
    gradeId = grade.id;
  } else {
    const { data: createdGrade, error: gradeErr } = await admin.database
      .from("product_grades")
      .insert([{ product_id: productId, name: "มาตรฐาน", sort_order: 0 }])
      .select("id")
      .limit(1);
    if (gradeErr || !createdGrade?.length)
      throw new Error(`grade create failed: ${gradeErr?.message}`);
    gradeId = (createdGrade as unknown as { id: string }[])[0].id;
  }
  return { id: productId, gradeId };
}

async function ensureSellerKyc(): Promise<void> {
  const admin = createInsForgeAdminClient();

  // Look up both the seller + the admin (reviewer). The kyc_submissions row
  // needs a reviewer id — nullable in the schema, but we set it for realism.
  const { data: profiles } = await admin.database
    .from("profiles")
    .select("id, phone, kyc_status, is_admin")
    .in("phone", [TEST.seller.phone, TEST.admin.phone]);
  const rows =
    (profiles as unknown as
      | { id: string; phone: string; kyc_status: string; is_admin: boolean }[]
      | null) ?? [];
  const seller = rows.find((r) => r.phone === TEST.seller.phone);
  if (!seller) throw new Error("seller profile not found");
  const reviewer = rows.find((r) => r.is_admin);

  if (seller.kyc_status === "Approved") return; // idempotent

  // Insert a KYC submission (status APPROVED per the CHECK constraint, which
  // accepts PENDING/APPROVED/REJECTED — uppercase). The column names are
  // id_card_photo_url/_key + selfie_url/_key (NOT id_card_photo/selfie_photo).
  await admin.database.from("kyc_submissions").insert([
    {
      user_id: seller.id,
      id_card_photo_url: "https://example.com/test-id.jpg",
      id_card_photo_key: "test/test-id.jpg",
      selfie_url: "https://example.com/test-selfie.jpg",
      selfie_key: "test/test-selfie.jpg",
      status: "APPROVED",
      reviewed_by: reviewer?.id ?? null,
      reviewed_at: new Date().toISOString(),
    },
  ]);
  // Flip the seller's headline profile.kyc_status to "Approved" (PascalCase,
  // per the KycStatus enum in @agrimarket/shared — distinct from the
  // uppercase submission.status).
  const { error } = await admin.database
    .from("profiles")
    .update({ kyc_status: "Approved" })
    .eq("id", seller.id);
  if (error) throw new Error(`seller KYC update failed: ${error.message}`);
}
