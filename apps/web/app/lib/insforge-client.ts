import { createBrowserClient } from "@insforge/sdk/ssr";

// Browser client for Client Components + browser SDK calls (Storage, Realtime).
// Reads `insforge_access_token` cookie automatically; refreshes via
// /api/auth/refresh when the token is expired.
export const insforge = createBrowserClient();
