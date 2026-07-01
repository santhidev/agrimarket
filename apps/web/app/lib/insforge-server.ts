import { cookies } from "next/headers";
import { createServerClient } from "@insforge/sdk/ssr";

// Server client for Server Components, Route Handlers, and Server Actions.
// Reads the access-token cookie per-request.
export async function createInsForgeServerClient() {
  return createServerClient({ cookies: await cookies() });
}
