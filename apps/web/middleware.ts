import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge runtime middleware: protects feature routes via the `authorized`
// callback in auth.config.ts. Home (/), /login, /api/* are public.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except Next internals + static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
