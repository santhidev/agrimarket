// AgriMarket phone OTP edge function (InsForge Deno Subhosting).
//
// Actions:
//   { action: "request", phone }  → generate + store OTP, return { expiresIn, testCode? }
//   { action: "verify", phone, code } → verify, find-or-create user, return { user }
//
// Test mode: OTP_TEST_MODE env !== "false" → code is always "000000".
// OTP stored in the `otp_codes` table with a 5-minute TTL.

import { createClient, createAdminClient } from "npm:@insforge/sdk";

const TEST_CODE = "000000";
const TTL_SECONDS = 300;
const MAX_ATTEMPTS = 5;

const isTestMode = () => Deno.env.get("OTP_TEST_MODE") !== "false";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Admin client — full access (bypasses RLS) for OTP table + user creation.
// InsForge sets these env vars automatically for edge functions.
function adminClient() {
  return createAdminClient({
    baseUrl: Deno.env.get("INSFORGE_BASE_URL")!,
    apiKey: Deno.env.get("API_KEY")!,
  });
}

async function generateOtp(phone: string): Promise<string> {
  const code = isTestMode() ? TEST_CODE : randomCode(6);
  const client = adminClient();

  // Clean up old codes for this phone, then insert the new one.
  const { error: delErr } = await client.database
    .from("otp_codes")
    .delete()
    .eq("phone", phone);
  const { error } = await client.database.from("otp_codes").insert([
    {
      phone,
      code,
      attempts: 0,
      expires_at: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
    },
  ]);
  if (error) throw new Error(`Failed to store OTP: ${JSON.stringify(error)} (delete: ${JSON.stringify(delErr)})`);
  return code;
}

async function verifyOtp(phone: string, code: string): Promise<boolean> {
  if (!code) return false;
  const client = adminClient();

  const { data, error } = await client.database
    .from("otp_codes")
    .select("id, code, attempts, expires_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return false;

  const row = data[0];
  // Expired?
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await client.database.from("otp_codes").delete().eq("id", row.id);
    return false;
  }

  // Wrong code → increment attempts
  if (row.code !== code) {
    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await client.database.from("otp_codes").delete().eq("id", row.id);
    } else {
      await client.database.from("otp_codes").update({ attempts }).eq("id", row.id);
    }
    return false;
  }

  // Success: consume all codes for this phone.
  await client.database.from("otp_codes").delete().eq("phone", phone);
  return true;
}

async function findOrCreateUser(phone: string) {
  const client = adminClient();
  const email = `${phone}@phone.agrimarket`;
  // Deterministic password derived from phone — never used by humans; the OTP
  // flow is the real gate. This lets us signUp once then signInWithPassword
  // on subsequent logins to establish an InsForge session.
  const password = `otp-${phone}-agrimarket`;

  // Try signUp — succeeds for new users, errors for existing.
  // autoConfirm: true skips email verification (phone OTP is the real gate).
  //
  // The on_auth_user_created DB trigger auto-inserts a public.profiles row
  // for every new auth.users row, so the web app always finds a profile to
  // read from. No profile work is needed here.
  const { data } = await client.auth.signUp({
    email,
    password,
    autoConfirm: true,
  });

  // `user` is present for a brand-new signup; absent for an existing user
  // (signUp errors). The web verifyOtpAction gates on `data.user`, so keep
  // it truthy in both branches by returning a minimal marker for existing
  // users — the real identity used for the session is email + password below.
  if (data?.user) {
    return {
      user: { id: data.user.id, email: data.user.email },
      email,
      phone,
      password,
      profile: { phone },
    };
  }

  // Existing user — return identity for session creation.
  return { user: { email }, email, phone, password, profile: { phone } };
}

function randomCode(length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, phone, code } = body as {
      action?: string;
      phone?: string;
      code?: string;
    };

    if (!phone || typeof phone !== "string") {
      return json({ error: "Phone is required" }, 400);
    }

    if (action === "request") {
      const otp = await generateOtp(phone);
      return json({
        expiresIn: TTL_SECONDS,
        ...(isTestMode() ? { testCode: otp } : {}),
      });
    }

    if (action === "verify") {
      if (!code) return json({ error: "Code is required" }, 400);
      const ok = await verifyOtp(phone, code);
      if (!ok) {
        return json({ error: "Invalid or expired OTP" }, 401);
      }
      const user = await findOrCreateUser(phone);
      return json({ user });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500
    );
  }
}
