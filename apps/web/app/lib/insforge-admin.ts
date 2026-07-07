import { createAdminClient } from "@insforge/sdk";

// Service-role admin client (Issue 09).
//
// The SSR client (insforge-server.ts) runs every query under the caller's RLS
// — correct for user-initiated reads/writes, but the background jobs have no
// user session and must UPDATE demands belonging to every buyer + INSERT
// notification rows for those buyers. That requires bypassing RLS, which the
// service-role / API key does (createAdminClient treats INSFORGE_API_KEY as a
// full-access admin key).
//
// Server-only. Never import into a Client Component — INSFORGE_API_KEY is a
// privileged secret. Routes consume this for system-level writes only (the
// cron jobs in app/api/cron/**); user-scoped reads/writes keep using the SSR
// client so they stay RLS-bounded.
export function createInsForgeAdminClient() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "InsForge admin client missing NEXT_PUBLIC_INSFORGE_URL or INSFORGE_API_KEY"
    );
  }
  return createAdminClient({ baseUrl, apiKey });
}
