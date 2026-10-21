// One-off move of the old single-computer data (SQLite + photos folder) into Postgres.
//
//   pnpm --filter @peterhouse/backend import-sqlite -- /path/to/old/data
//
// Run it against an EMPTY database (it refuses otherwise), with the same DATA_ENCRYPTION_KEYS the server will use.
// Everything personal is encrypted on the way in. Old sign-in accounts, the activity log and AI keys are not copied:
// create people with `create-admin` / the People page, and keep AI keys in the server's environment.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sealJson, sealText } from "../domain/records";
import { encryptBytes } from "../crypto";
import { one, pool, run, tx } from "../db";
import { migrate } from "../migrate";

const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, "learning-review.db"))) {
  console.error("Usage: pnpm --filter @peterhouse/backend import-sqlite -- <folder containing learning-review.db>");
  process.exit(1);
}

type Row = Record<string, any>;
const old = new Database(path.join(dir, "learning-review.db"), { readonly: true });
const all = (sql: string): Row[] => old.prepare(sql).all() as Row[];
const json = (s: string | null) => (s ? JSON.parse(s) : null);
const iso = (s: string | null) => (s ? new Date(s).toISOString() : null);

try {
  await migrate(pool, () => {});
  const existing = await one<{ n: number }>("SELECT count(*)::int AS n FROM children");
  if (existing && existing.n > 0) throw new Error("The target database already has children. Import into an empty database only.");

  const counts = await tx(async (c) => {
    // The server creates an empty starting term and class on first start; the old ones replace them.
    await run("DELETE FROM classes", [], c);
    await run("DELETE FROM terms", [], c);

    const term = new Map<number, number>();
    for (const t of all("SELECT * FROM terms")) {
      const r = await one<{ id: number }>("INSERT INTO terms (semester, year, status) VALUES ($1, $2, $3) RETURNING id", [t.season === "June" ? 1 : 2, t.year, t.status], c);
      term.set(t.id, r!.id);
    }
    const cls = new Map<number, number>();
    for (const k of all("SELECT * FROM classes")) {
      const r = await one<{ id: number }>("INSERT INTO classes (term_id, name, level) VALUES ($1, $2, $3) RETURNING id", [term.get(k.term_id), k.name, k.level === "Nursery" ? "N2" : k.level], c);
      cls.set(k.id, r!.id);
    }
    const child = new Map<number, number>();
    for (const k of all("SELECT * FROM children")) {
      const r = await one<{ id: number }>(
        "INSERT INTO children (preferred_name, legal_name, date_of_birth, pronoun, photo_consent, status, left_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
        [sealText(k.preferred_name, "children.preferred_name"), sealText(k.legal_name, "children.legal_name"), sealText(k.date_of_birth ?? "", "children.date_of_birth"), k.pronoun, !!k.photo_consent, k.status, iso(k.left_at)],
        c,
      );
      child.set(k.id, r!.id);
    }
    const review = new Map<number, number>();
    for (const r of all("SELECT * FROM reviews")) {
      const row = await one<{ id: number }>(
        `INSERT INTO reviews (child_id, term_id, class_id, status, rubric, highlight, highlight_at, no_photo, staff_note, strengths, next_steps, draft, report_version, approved_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, $15) RETURNING id`,
        [
          child.get(r.child_id), term.get(r.term_id), cls.get(r.class_id), r.status === "not_started" ? "draft" : r.status, r.rubric,
          sealText(r.highlight ?? "", "reviews.highlight"), iso(r.highlight_at), !!r.no_photo, sealText(r.staff_note ?? "", "reviews.staff_note"),
          r.strengths, r.next_steps, r.draft ? sealJson(json(r.draft), "reviews.draft") : null, r.report_version, iso(r.approved_at), iso(r.updated_at) ?? new Date().toISOString(),
        ],
        c,
      );
      review.set(r.id, row!.id);
    }
    for (const n of all("SELECT * FROM review_notes")) {
      await run("INSERT INTO review_notes (review_id, key, text) VALUES ($1, $2, $3)", [review.get(n.review_id), n.key, sealText(n.text, "review_notes.text")], c);
    }
    for (const a of all("SELECT * FROM review_areas")) {
      await run("INSERT INTO review_areas (review_id, area_key, data, updated_at) VALUES ($1, $2, $3, $4)", [review.get(a.review_id), a.area_key, sealJson(json(a.data), "review_areas.data"), iso(a.updated_at)], c);
    }
    for (const v of all("SELECT * FROM draft_versions")) {
      await run("INSERT INTO draft_versions (review_id, draft, replaced_at) VALUES ($1, $2, $3)", [review.get(v.review_id), sealJson(json(v.draft), "draft_versions.draft"), iso(v.replaced_at)], c);
    }
    let photos = 0;
    for (const p of all("SELECT * FROM review_photos ORDER BY review_id, position, id")) {
      const file = path.join(dir, "photos", path.basename(p.file));
      if (!fs.existsSync(file)) {
        console.warn(`  skipped photo ${p.id}: ${p.file} is missing`);
        continue;
      }
      await run("INSERT INTO review_photos (review_id, data, position, added_at) VALUES ($1, $2, $3, $4)", [review.get(p.review_id), encryptBytes(fs.readFileSync(file)), p.position, iso(p.added_at)], c);
      photos++;
    }
    for (const s of all("SELECT * FROM settings WHERE key IN ('school', 'records', 'rubric')")) {
      await run("INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [s.key, s.value], c);
    }
    return { children: child.size, reviews: review.size, photos };
  });
  console.log(`Imported ${counts.children} children, ${counts.reviews} reviews and ${counts.photos} photos.`);
  console.log("Now create sign-ins: pnpm --filter @peterhouse/backend create-admin -- you@school.sg \"Your Name\"");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  old.close();
  await pool.end();
}
