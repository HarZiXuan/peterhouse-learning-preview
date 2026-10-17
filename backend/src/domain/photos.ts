import sharp from "sharp";
import { decryptBytes, encryptBytes } from "../crypto";
import { many, one, run } from "../db";
import { HttpError } from "../http";

export const MAX_PHOTOS = 8;

export type ReviewPhoto = { id: number; position: number };

export const listPhotos = (reviewId: number) =>
  many<ReviewPhoto>("SELECT id, position FROM review_photos WHERE review_id = $1 ORDER BY position, id", [reviewId]);

/** Photos the report may show: only when the child's parents gave photo consent. */
export async function reportPhotoIds(reviewId: number): Promise<number[]> {
  return (await hasPhotoConsent(reviewId)) ? (await listPhotos(reviewId)).map((p) => p.id) : [];
}

export async function hasPhotoConsent(reviewId: number): Promise<boolean> {
  const row = await one<{ consent: boolean }>("SELECT c.photo_consent AS consent FROM reviews r JOIN children c ON c.id = r.child_id WHERE r.id = $1", [reviewId]);
  return !!row?.consent;
}

export const setPhotoConsent = (reviewId: number, consent: boolean) =>
  run("UPDATE children SET photo_consent = $1 WHERE id = (SELECT child_id FROM reviews WHERE id = $2)", [consent, reviewId]);

/** Re-encodes the upload (rotated upright, max 1600px, metadata stripped), encrypts it, and stores it in the database. */
export async function addPhoto(reviewId: number, input: Buffer): Promise<ReviewPhoto> {
  if ((await listPhotos(reviewId)).length >= MAX_PHOTOS) throw new HttpError(400, `Up to ${MAX_PHOTOS} photos per report.`);
  let out: Buffer;
  try {
    out = await sharp(input).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer();
  } catch {
    throw new HttpError(400, "That file is not a photo we can read. Use a JPG or PNG.");
  }
  const row = await one<{ id: number; position: number }>(
    `INSERT INTO review_photos (review_id, data, position)
     VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM review_photos WHERE review_id = $1)) RETURNING id, position`,
    [reviewId, encryptBytes(out)],
  );
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
