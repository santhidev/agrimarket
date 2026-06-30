import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config (no Node-only deps here — used by middleware).
// Providers are added in auth.ts (Node runtime). Per the nextauth-authentication
// skill's "Split Configuration for Edge + Database" pattern.

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [
    // Added in auth.ts (the full config). Edge config keeps this empty.
  ],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // Routes that require authentication. Add feature routes here as they
      // are built (e.g. /demands, /offers, /profile, /admin).
      const protectedPrefixes = ["/dashboard", "/profile", "/admin", "/demands", "/offers"];
      const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

      if (isProtected) {
        return isLoggedIn; // redirect to /login if not logged in
      }
      return true;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
