import express, { Router } from "express";
import { z } from "zod";
import type { AreaAnswer, ReportSection, ReportView, ReviewView } from "@peterhouse/shared";
import { audit } from "../audit";
import { createSession, currentUser, destroySession } from "../auth";
import { HttpError, idParam, parse } from "../http";
import { buildReportData, editParagraph, EXTRA_NOTES, getReviewForUser, loadAnswers, loadNotes, rewriteParagraph, saveArea, saveHighlight, saveNote, syncRubric, writeDraft } from "../domain/reviews";
import { addPhoto, deletePhoto, hasPhotoConsent, listPhotos, MAX_PHOTOS, photoReviewId, readPhoto, setPhotoConsent } from "../domain/photos";
import { renderReportPdf } from "../domain/pdf";
import { getSchool } from "../domain/school";

export const reviewsRouter = Router();

const Answer = z.object({
  skills: z.record(z.object({ level: z.number().int().min(0).max(5), touched: z.boolean().optional() })),
  moments: z.array(z.string().max(200)).max(20),
  note: z.string().max(2000),
  visited: z.boolean().optional(),
});

reviewsRouter.get("/reviews/:id", async (req, res) => {
  const user = currentUser(req);
  const first = await getReviewForUser(user, idParam(req.params.id));
  const r = await syncRubric(first);
  const { answers } = await loadAnswers(r.id, r.rubric);
  const view: ReviewView = {
    reviewId: r.id,
    childName: r.preferred_name,
    rubric: r.rubric,
    answers,
    highlight: r.highlight,
    notes: await loadNotes(r.id),
    noteDefs: EXTRA_NOTES.map((n) => ({ ...n })),
    hasReport: !!r.draft,
    photos: (await listPhotos(r.id)).map((p) => ({ id: p.id })),
    photoConsent: await hasPhotoConsent(r.id),
    maxPhotos: MAX_PHOTOS,
  };
  await audit(req, user.id, "review.viewed", { reviewId: r.id, childId: r.child_id });
  res.json(view);
});

reviewsRouter.put("/reviews/:id/areas/:areaKey", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const answer = parse(Answer, req.body);
  const result = await saveArea(user, id, req.params.areaKey, { ...answer, visited: true } as AreaAnswer);
  res.json(result);
});

reviewsRouter.put("/reviews/:id/notes/:key", async (req, res) => {
  const { text } = parse(z.object({ text: z.string().max(2000) }), req.body);
  res.json(await saveNote(currentUser(req), idParam(req.params.id), req.params.key, text));
});

reviewsRouter.put("/reviews/:id/highlight", async (req, res) => {
  const { text } = parse(z.object({ text: z.string().max(2000) }), req.body);
  res.json(await saveHighlight(currentUser(req), idParam(req.params.id), text));
});

/** Creates (or recreates) the whole report from the answers. */
reviewsRouter.post("/reviews/:id/report", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const r = await getReviewForUser(user, id);
  // Make sure the status reflects the latest answers before writing.
  await saveHighlight(user, id, r.highlight);
  const outcome = await writeDraft(user, id);
  if (outcome.ok) await audit(req, user.id, "report.written", { reviewId: id, childId: r.child_id, detail: outcome.provider });
  res.json(outcome);
});

reviewsRouter.get("/reviews/:id/report", async (req, res) => {
  const user = currentUser(req);
  const r = await getReviewForUser(user, idParam(req.params.id));
  if (!r.draft) throw new HttpError(404, "Create the report first.", "no_draft");
  const draft = r.draft;
  const sections: ReportSection[] = [
    ...draft.paragraphs.map((p) => ({ key: p.key, title: p.title, text: p.text })),
    { key: "home", title: "Ideas to try at home (one per line)", text: draft.homeIdeas.join("\n") },
  ];
  const view: ReportView = {
    reviewId: r.id,
    childName: r.preferred_name,
    data: await buildReportData(r),
    school: await getSchool(),
    sections,
    notes: draft.notes,
    provider: draft.provider,
  };
  res.json(view);
});

reviewsRouter.put("/reviews/:id/paragraphs/:key", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const { text } = parse(z.object({ text: z.string().max(4000) }), req.body);
  await editParagraph(user, id, req.params.key, text);
  await audit(req, user.id, "report.edited", { reviewId: id });
  res.json({ ok: true });
});

reviewsRouter.post("/reviews/:id/paragraphs/:key/rewrite", async (req, res) => {
  const { tone } = parse(z.object({ tone: z.enum(["Shorter", "Warmer", "Simpler"]).optional() }), req.body ?? {});
  res.json(await rewriteParagraph(currentUser(req), idParam(req.params.id), req.params.key, tone));
});

reviewsRouter.get("/reviews/:id/pdf", async (req, res) => {
  const user = currentUser(req);
  const r = await getReviewForUser(user, idParam(req.params.id));
  if (!r.draft) throw new HttpError(400, "Create the report first.");
  // The print browser signs in as this person with a session that lasts two minutes and is deleted straight after.
  const token = await createSession(user.id, null, 120_000);
  try {
    const pdf = await renderReportPdf(r.id, token);
    await audit(req, user.id, "report.pdf_downloaded", { reviewId: r.id, childId: r.child_id });
    const name = `${r.preferred_name.replace(/[^\p{L}\p{N}]+/gu, "_")}_${r.season}_${r.year}_Learning_Review.pdf`;
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    });
    res.send(pdf);
  } catch (e) {
    console.error(e);
    throw new HttpError(500, e instanceof Error ? e.message : "The PDF could not be made.");
  } finally {
    await destroySession(token);
  }
});

// ─── Photos ──────────────────────────────────────────────────────────────

reviewsRouter.post("/reviews/:id/photos", express.raw({ type: "image/*", limit: "25mb" }), async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const r = await getReviewForUser(user, id);
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, "No photo was sent.");
  await addPhoto(id, req.body);
  // The teacher adding a photo for the report counts as agreeing to use it; the box on the child's page can be unticked.
  if (!(await hasPhotoConsent(id))) await setPhotoConsent(id, true);
  await audit(req, user.id, "photo.added", { reviewId: id, childId: r.child_id });
  res.json({ photos: (await listPhotos(id)).map((p) => ({ id: p.id })), consent: true });
});

reviewsRouter.put("/reviews/:id/photo-consent", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const r = await getReviewForUser(user, id);
  const { consent } = parse(z.object({ consent: z.boolean() }), req.body);
  await setPhotoConsent(id, consent);
  await audit(req, user.id, "photo.consent_changed", { reviewId: id, childId: r.child_id, detail: String(consent) });
  res.json({ ok: true });
});

reviewsRouter.get("/photos/:photoId", async (req, res) => {
  const photoId = idParam(req.params.photoId);
  const reviewId = await photoReviewId(photoId);
  if (!reviewId) throw new HttpError(404, "Not found.");
  await getReviewForUser(currentUser(req), reviewId);
  const bytes = await readPhoto(photoId);
  if (!bytes) throw new HttpError(404, "Not found.");
  res.set({ "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" });
  res.send(bytes);
});

reviewsRouter.delete("/reviews/:id/photos/:photoId", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const photoId = idParam(req.params.photoId);
  const r = await getReviewForUser(user, id);
  if ((await photoReviewId(photoId)) !== id) throw new HttpError(404, "Not found.");
  await deletePhoto(photoId);
  await audit(req, user.id, "photo.removed", { reviewId: id, childId: r.child_id });
  res.json({ photos: (await listPhotos(id)).map((p) => ({ id: p.id })) });
});
