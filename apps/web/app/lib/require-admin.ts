import { getCurrentUser } from "@/app/lib/get-profile";

type ResolvedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// Outcome of an admin-gate check. `user` is present on success; on failure
// `status` carries the HTTP status to respond with.
export type AdminGateResult =
  | { ok: true; user: ResolvedUser }
  | { ok: false; status: 401 | 403 };

// Pure decision extracted for unit testing (no InsForge/cookies needed).
// - no session user  → 401 (must authenticate)
// - session user not admin → 403 (forbidden)
// - session user is admin → allow
export function decideAdminGate(user: ResolvedUser | null): AdminGateResult {
  if (!user) return { ok: false, status: 401 };
  if (!user.isAdmin) return { ok: false, status: 403 };
  return { ok: true, user };
}

// Enforce that the current session user is an admin. Use at the top of every
// `/api/admin/*` route handler.
export async function requireAdmin(): Promise<AdminGateResult> {
  const user = await getCurrentUser();
  return decideAdminGate(user);
}
