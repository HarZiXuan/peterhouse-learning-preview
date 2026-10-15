import { NextResponse, type NextRequest } from "next/server";
import { getReviewRow } from "@/lib/reviews";
import { addPhoto, hasPhotoConsent, listPhotos, setPhotoConsent } from "@/lib/photos";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!getReviewRow(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const file = (await req.formData()).get("photo");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No photo was sent." }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "That photo is too large (25 MB max)." }, { status: 413 });
  try {
    await addPhoto(id, Buffer.from(await file.arrayBuffer()));
    // The teacher adding a photo for the report counts as agreeing to use it; the box on the child's page can be unticked.
    if (!hasPhotoConsent(id)) setPhotoConsent(id, true);
    return NextResponse.json({ photos: listPhotos(id), consent: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save the photo." }, { status: 400 });
  }
}
