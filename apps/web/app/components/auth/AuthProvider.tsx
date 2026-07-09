"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Client-side auth state, shared via React context.
//
// Why this exists: previously each page had to resolve the session server-side
// and pass `isLoggedIn`/`userName`/`userId` down to TopNav as props. Client
// Component pages (e.g. /demands/new) and pages that didn't resolve the user
// fell back to `isLoggedIn=false`, so a signed-in user saw "เข้าสู่ระบบ" links
// and got bounced to /login. The provider fetches /api/auth/me once on mount,
// so every page reads the same source of truth.

export type AuthUser = {
  id: string;
  phone: string;
  isAdmin: boolean;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  // Drop the cached user after a sign-out server action clears the session
  // cookie. The server action returns to the client without a navigation, so
  // React state would otherwise keep showing "logged in" until a full reload.
  clearUser: () => void;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  clearUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data: { user?: AuthUser | null }) => {
        if (cancelled) return;
        setUser(data.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearUser = useCallback(() => setUser(null), []);

  return (
    <AuthContext.Provider value={{ user, loading, clearUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
