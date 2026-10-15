import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { db, nowIso, PHOTO_DIR } from "./db";

export const MAX_PHOTOS = 8;

export type ReviewPhoto = { id: number; position: number };

export function listPhotos(reviewId: number): ReviewPhoto[] {
  return db().prepare("SELECT id, position FROM review_photos WHERE review_id = ? ORDER BY position, id").all(reviewId) as ReviewPhoto[];
}

/** Photos the report may show: only when the child's parents gave photo consent. */
export function reportPhotoIds(reviewId: number): number[] {
  const row = db()
    .prepare("SELECT c.photo_consent AS consent FROM reviews r JOIN children c ON c.id = r.child_id WHERE r.id = ?")
    .get(reviewId) as { consent: number } | undefined;
  return row?.consent ? listPhotos(reviewId).map((p) => p.id) : [];
}

export function hasPhotoConsent(reviewId: number): boolean {
  const row = db()
    .prepare("SELECT c.photo_consent AS consent FROM reviews r JOIN children c ON c.id = r.child_id WHERE r.id = ?")
    .get(reviewId) as { consent: number } | undefined;
  return !!row?.consent;
}

export function setPhotoConsent(reviewId: number, consent: boolean) {
  db()
    .prepare("UPDATE children SET photo_consent = ? WHERE id = (SELECT child_id FROM reviews WHERE id = ?)")
    .run(consent ? 1 : 0, reviewId);
}

/** Re-encodes the upload (rotated upright, max 1600px, metadata stripped) and stores it. */
export async function addPhoto(reviewId: number, input: Buffer): Promise<ReviewPhoto> {
  if (listPhotos(reviewId).length >= MAX_PHOTOS) throw new Error(`Up to ${MAX_PHOTOS} photos per report.`);
  let out: Buffer;
  try {
    out = await sharp(input).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer();
  } catch {
    throw new Error("That file is not a photo we can read. Use a JPG or PNG.");
  }
  const file = `${reviewId}-${crypto.randomBytes(6).toString("hex")}.jpg`;
  fs.writeFileSync(path.join(PHOTO_DIR, file), out);
  const pos = (db().prepare("SELECT COALESCE(MAX(position), -1) + 1 AS n FROM review_photos WHERE review_id = ?").get(reviewId) as { n: number }).n;
  const info = db().prepare("INSERT INTO review_photos (review_id, file, position, added_at) VALUES (?, ?, ?, ?)").run(reviewId, file, pos, nowIso());
  return { id: Number(info.lastInsertRowid), position: pos };
}

export function photoFile(photoId: number): string | null {
  const row = db().prepare("SELECT file FROM review_photos WHERE id = ?").get(photoId) as { file: string } | undefined;
  if (!row) return null;
  const full = path.join(PHOTO_DIR, path.basename(row.file));
  return fs.existsSync(full) ? full : null;
}

export function deletePhoto(photoId: number) {
  const row = db().prepare("SELECT file FROM review_photos WHERE id = ?").get(photoId) as { file: string } | undefined;
  if (!row) return;
  db().prepare("DELETE FROM review_photos WHERE id = ?").run(photoId);
  fs.rmSync(path.join(PHOTO_DIR, path.basename(row.file)), { force: true });
}
