import sharp from "sharp";
import { decryptBytes, encryptBytes } from "../crypto";
import { many, one, run } from "../db";
import { HttpError } from "../http";
import { COVER_PHOTO_KEY, PHOTOS_PER_AREA } from "@peterhouse/shared";

export type ReviewPhoto = { id: number; position: number; area_key: string | null };

export const listPhotos = (reviewId: number) =>
  many<ReviewPhoto>("SELECT id, position, area_key FROM review_photos WHERE review_id = $1 ORDER BY position, id", [reviewId]);

export const photoView = (p: ReviewPhoto) => ({ id: p.id, areaKey: p.area_key });

/** Photos the report shows: every photo added to the review. */
export async function reportPhotoIds(reviewId: number): Promise<number[]> {
  return (await listPhotos(reviewId)).map((p) => p.id);
}

/**
 * Re-encodes the upload (rotated upright, max 1600px, metadata stripped), encrypts it, and stores it in the database.
 * The report has room for one photo on each learning page and one on the cover (`areaKey` is the area's key or "cover"),
 * so a new photo takes the place of the one that was there.
 */
export async function addPhoto(reviewId: number, areaKey: string, input: Buffer): Promise<ReviewPhoto> {
  let out: Buffer;
  try {
    out = await sharp(input).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer();
  } catch {
    throw new HttpError(400, "That file is not a photo we can read. Use a JPG or PNG.");
  }
  const row = await one<ReviewPhoto>(
    `INSERT INTO review_photos (review_id, data, position, area_key)
     VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM review_photos WHERE review_id = $1), $3) RETURNING id, position, area_key`,
    [reviewId, encryptBytes(out), areaKey],
  );
  const there = (await listPhotos(reviewId)).filter((p) => p.area_key === areaKey && p.id !== row!.id);
  if (there.length + 1 > PHOTOS_PER_AREA) await run("DELETE FROM review_photos WHERE id = ANY($1::bigint[])", [there.map((p) => p.id)]);
  return row!;
}

/** The photo's review (so the caller can check access first) and its decrypted bytes. */
export async function photoReviewId(photoId: number): Promise<number | null> {
  return (await one<{ review_id: number }>("SELECT review_id FROM review_photos WHERE id = $1", [photoId]))?.review_id ?? null;
}

export async function readPhoto(photoId: number): Promise<Buffer | null> {
  const row = await one<{ data: Buffer }>("SELECT data FROM review_photos WHERE id = $1", [photoId]);
  return row ? decryptBytes(row.data) : null;
}

export const deletePhoto = (photoId: number) => run("DELETE FROM review_photos WHERE id = $1", [photoId]);
