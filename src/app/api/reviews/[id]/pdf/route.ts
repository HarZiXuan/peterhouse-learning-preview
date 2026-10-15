import { NextResponse, type NextRequest } from "next/server";
import { getReviewRow } from "@/lib/reviews";
import { renderReportPdf } from "@/lib/pdf";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = getReviewRow(Number((await params).id));
  if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!r.draft) return NextResponse.json({ error: "Create the report first." }, { status: 400 });
  try {
    const pdf = await renderReportPdf(
      // Behind the proxy the request URL names the wrong protocol and host, so print from the server's own address.
      process.env.INTERNAL_ORIGIN || req.nextUrl.origin,
      r.id,
      req.cookies.get(SESSION_COOKIE)?.value,
    );
    const name = `${r.preferred_name.replace(/[^\p{L}\p{N}]+/gu, "_")}_${r.season}_${r.year}_Learning_Review.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "The PDF could not be made." }, { status: 500 });
  }
}
