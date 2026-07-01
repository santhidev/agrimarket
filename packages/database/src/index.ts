import { createClient } from "@insforge/sdk";

/**
 * InsForge client singleton for AgriMarket.
 *
 * Uses the anon key for user-scoped access (RLS-enforced). The URL + anon key
 * are read from the consuming app's environment (NEXT_PUBLIC_* for Next.js).
 *
 * For privileged server-only operations (seeding, migrations, admin queries),
 * use `createAdminClient()` below which authenticates with the full-access
 * API key from `.insforge/project.json`.
 */

const url = process.env.NEXT_PUBLIC_INSFORGE_URL;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "NEXT_PUBLIC_INSFORGE_URL and NEXT_PUBLIC_INSFORGE_ANON_KEY must be set."
  );
}

export const insforge = createClient({ baseUrl: url, anonKey });

/**
 * Admin client — full access, bypasses RLS. Server-only; never import in
 * client components. Reads the API key from .insforge/project.json via the
 * INSFORGE_API_KEY env var (set by the deployment, not committed).
 */
export function createAdminClient() {
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!apiKey) {
    throw new Error("INSFORGE_API_KEY is not set (admin-only operation).");
  }
  return createClient({ baseUrl: url, anonKey, apiKey });
}
