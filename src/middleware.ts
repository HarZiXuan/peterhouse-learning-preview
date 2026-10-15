import { NextResponse, type NextRequest } from "next/server";
import { authRequired, SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  if (!authRequired()) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  // Behind the reverse proxy the request URL names the internal address, so redirect with a relative Location.
  const to = pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname + search)}`;
  return new NextResponse(null, { status: 307, headers: { Location: to } });
}

export const config = {
  // Everything except Next's own assets and the public brand/icon files.
  matcher: ["/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|favicon.ico).*)"],
};
