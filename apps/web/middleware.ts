import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@insforge/sdk/ssr/middleware";

// InsForge SSR middleware — refreshes the session cookie before Server
// Components render. Feature routes are protected in-page (redirect to /login
// if no session); middleware just keeps the cookie fresh.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  await updateSession({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });
  return response;
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
