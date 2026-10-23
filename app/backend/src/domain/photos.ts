import sharp from "sharp";
import { decryptBytes, encryptBytes } from "../crypto";
import { many, one, run } from "../db";
import { HttpError } from "../http";
import { COVER_PHOTO_KEY, PHOTOS_PER_AREA, type SessionUser } from "@peterhouse/shared";
import { canAccessClass } from "./reviews";

export type ReviewPhoto = { id: number; position: number; area_key: string | null };

export const listPhotos = (reviewId: number) =>
  many<ReviewPhoto>("SELECT id, position, area_key FROM review_photos WHERE review_id = $1 ORDER BY position, id", [reviewId]);

export const photoView = (p: ReviewPhoto) => ({ id: p.id, areaKey: p.area_key });

/** Photos the report shows: every photo added to the review. */
export async function reportPhotoIds(reviewId: number): Promise<number[]> {
  return (await listPhotos(reviewId)).map((p) => p.id);
}

/** Rotated upright, at most 1600px, metadata stripped, as JPEG. */
async function cleanImage(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer();
  } catch {
    throw new HttpError(400, "That file is not a photo we can read. Use a JPG or PNG.");
  }
}

/**
 * Re-encodes the upload (rotated upright, max 1600px, metadata stripped), encrypts it, and stores it in the database.
 * The report has room for one photo on each learning page and one on the cover (`areaKey` is the area's key or "cover"),
 * so a new photo takes the place of the one that was there.
 */
export async function addPhoto(reviewId: number, areaKey: string, input: Buffer): Promise<ReviewPhoto> {
  const out = await cleanImage(input);
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

// ─── A child's profile photo ─────────────────────────────────────────────
// One per child, kept across semesters, encrypted like every other photo. It is the cover of the child's report.

/** Administrators see every child; a teacher sees the children of a class they teach this semester or taught before. */
export async function canSeeChild(user: SessionUser, childId: number): Promise<boolean> {
  if (user.role === "admin") return !!(await one("SELECT 1 FROM children WHERE id = $1", [childId]));
  const classes = await many<{ class_id: number }>("SELECT DISTINCT class_id FROM reviews WHERE child_id = $1", [childId]);
  for (const k of classes) if (await canAccessClass(user, k.class_id)) return true;
  return false;
}

/** Stores the new photo and returns when it changed (part of its URL). */
export async function setChildPhoto(childId: number, input: Buffer): Promise<string> {
  const out = await cleanImage(input);
  const row = await one<{ photo_at: string }>("UPDATE children SET photo = $1, photo_at = now() WHERE id = $2 RETURNING photo_at", [encryptBytes(out), childId]);
  if (!row) throw new HttpError(404, "Not found.");
  return row.photo_at;
}

export async function readChildPhoto(childId: number): Promise<Buffer | null> {
  const row = await one<{ photo: Buffer | null }>("SELECT photo FROM children WHERE id = $1", [childId]);
  return row?.photo ? decryptBytes(row.photo) : null;
}

export const clearChildPhoto = (childId: number) => run("UPDATE children SET photo = NULL, photo_at = NULL WHERE id = $1", [childId]);

// ─── A staff member's profile photo ──────────────────────────────────────
// One per account, encrypted like the others. Everyone signed in sees it; the person themselves or an administrator changes it.

export const canChangeUserPhoto = (user: SessionUser, userId: number) => user.role === "admin" || user.id === userId;

/** Stores the new photo and returns when it changed (part of its URL). */
export async function setUserPhoto(userId: number, input: Buffer): Promise<string> {
  if (!(await one("SELECT 1 FROM users WHERE id = $1", [userId]))) throw new HttpError(404, "That person could not be found.");
  const out = await cleanImage(input);
  const row = await one<{ changed_at: string }>(
    `INSERT INTO user_photos (user_id, data) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, changed_at = now() RETURNING changed_at`,
    [userId, encryptBytes(out)],
  );
  return row!.changed_at;
}

export async function readUserPhoto(userId: number): Promise<Buffer | null> {
  const row = await one<{ data: Buffer }>("SELECT data FROM user_photos WHERE user_id = $1", [userId]);
  return row ? decryptBytes(row.data) : null;
}

export const clearUserPhoto = (userId: number) => run("DELETE FROM user_photos WHERE user_id = $1", [userId]);
