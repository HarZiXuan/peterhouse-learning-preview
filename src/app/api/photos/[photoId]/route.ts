import fs from "node:fs";
import { NextResponse } from "next/server";
import { photoFile } from "@/lib/photos";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ photoId: string }> }) {
  const file = photoFile(Number((await params).photoId));
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600" },
  });
}
