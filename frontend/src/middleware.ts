import { NextResponse, type NextRequest } from "next/server";

// A first, cheap gate: no sign-in cookie, no page. The backend still checks every request for real
// (the cookie could be expired or forged), so this only saves a trip and picks where to send people.
const PUBLIC = ["/login"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();
  if (req.cookies.get("ph_session")?.value) return NextResponse.next();
  // Behind the reverse proxy the request URL names the internal address, so build the redirect from the public Host header.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const to = pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(new URL(to, `${proto}://${host}`));
}

export const config = {
  // Everything except the API (the backend authenticates it), Next's own assets and the public brand/icon files.
  matcher: ["/((?!api/|_next/static|_next/image|brand/|icon.png|apple-icon.png|favicon.ico).*)"],
};
