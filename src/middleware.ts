import { NextResponse, type NextRequest } from "next/server";
import { authRequired, SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  if (!authRequired()) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  // Behind the reverse proxy the request URL names the internal address, so build the redirect from the public Host header.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const to = pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(new URL(to, `${proto}://${host}`));
}

export const config = {
  // Everything except Next's own assets and the public brand/icon files.
  matcher: ["/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|favicon.ico).*)"],
};
