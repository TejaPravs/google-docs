import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

/**
 * UX-only redirects. Real authorization happens in every page/handler via
 * getSession()/requireUser() — never rely on middleware alone.
 */
export async function middleware(req: NextRequest) {
  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/docs") && !user) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/") && user) {
    return NextResponse.redirect(new URL("/docs", req.url));
  }
  if (pathname === "/" && !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/docs/:path*"] };
