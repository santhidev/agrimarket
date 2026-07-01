import { NextResponse, type NextRequest } from "next/server";
import { updateSession, type CookieStore } from "@insforge/sdk/ssr/middleware";

// InsForge SSR middleware — refreshes the session cookie before Server
// Components render. Feature routes are protected in-page (redirect to /login
// if no session); middleware just keeps the cookie fresh.
//
// Next.js 15.5's `RequestCookies` and the SDK's `CookieStore` don't line up:
// `RequestCookies.set` accepts `[key, value] | [options]` (no options slot),
// while the SDK expects `set(name, value, options?)`. We bridge the two with a
// thin adapter that satisfies the SDK's interface and delegates to the real
// cookie jars. Reads come from the request; writes go to the response so the
// refreshed token reaches the browser.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  await updateSession({
    requestCookies: cookieAdapter(request.cookies),
    responseCookies: cookieAdapter(response.cookies),
  });
  return response;
}

type NextCookieJar = {
  get(name: string): { value?: string } | undefined;
  set(name: string, value: string): unknown;
  delete(name: string): unknown;
};

// Implement the SDK's CookieStore against Next.js's cookie jars. The SDK
// declares overloaded `set`/`delete` (positional args OR an options object);
// Next.js only needs name+value, so the options object branch just unpacks it.
function cookieAdapter(jar: NextCookieJar): CookieStore {
  const get = (name: string) => jar.get(name)?.value;
  const set = (
    nameOrOptions: string | ({ name: string; value: string }),
    value?: string,
  ) => {
    if (typeof nameOrOptions === "string") {
      jar.set(nameOrOptions, value ?? "");
      return;
    }
    jar.set(nameOrOptions.name, nameOrOptions.value);
  };
  const del = (nameOrOptions: string | { name: string }) => {
    jar.delete(typeof nameOrOptions === "string" ? nameOrOptions : nameOrOptions.name);
  };
  return { get, set, delete: del } as CookieStore;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /api/auth/refresh (refresh endpoint, must run without middleware)
     * - /_next/static, /_next/image (Next internals)
     * - /favicon.ico
     */
    "/((?!api/auth/refresh|_next/static|_next/image|favicon.ico).*)",
  ],
};
