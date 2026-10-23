import express, { Router } from "express";
import { z } from "zod";
import type { AreaAnswer, PartPageView, ReportSection, ReportView, ReviewView } from "@peterhouse/shared";
import { COVER_PHOTO_KEY, PHOTOS_PER_AREA, areaProgress, childPhotoUrl, semesterLabel, userPhotoUrl } from "@peterhouse/shared";
import { audit } from "../audit";
import { createSession, currentUser, destroySession } from "../auth";
import { HttpError, idParam, parse } from "../http";
import { buildReportData, editParagraph, reportFor, getReviewForEdit, getReviewForUser, loadAnswers, lockReason, refreshReviewStatus, reopenPart, rewriteParagraph, saveArea, savePartText, sendPart, setChineseName, writeDraft, writePart } from "../domain/reviews";
import { isLead, leadName, partsView, waitingParts } from "../domain/parts";
import { submitForReview, takeBack, workflowFor } from "../domain/approval";
import { one } from "../db";
import { addPhoto, canChangeUserPhoto, canSeeChild, clearChildPhoto, clearUserPhoto, readUserPhoto, setUserPhoto, deletePhoto, listPhotos, photoReviewId, photoView, readChildPhoto, readPhoto, setChildPhoto } from "../domain/photos";
import { renderReportPdf } from "../domain/pdf";
import { getSchool } from "../domain/school";

export const reviewsRouter = Router();

const Answer = z.object({
  skills: z.record(z.object({ level: z.number().int().min(0).max(5), touched: z.boolean().optional() })),
  note: z.string().max(2000),
  visited: z.boolean().optional(),
  love: z.string().max(2000).optional(),
  home: z.array(z.string().max(300)).max(20).optional(),
});

reviewsRouter.get("/reviews/:id", async (req, res) => {
  const user = currentUser(req);
  // Looking does not freeze the question set; the first saved rating does (rule 2).
  const r = await getReviewForUser(user, idParam(req.params.id));
  const { answers } = await loadAnswers(r.id, r.rubric);
  const view: ReviewView = {
    reviewId: r.id,
    childId: r.child_id,
    photo: childPhotoUrl(r.child_id, r.photo_at),
    childName: r.legal_name,
    chineseName: r.chinese_name,
    pronoun: r.pronoun,
    status: r.status,
    rubric: r.rubric,
    answers,
    hasReport: !!r.draft,
    photos: (await listPhotos(r.id)).map(photoView),
    photosPerArea: PHOTOS_PER_AREA,
    photoConsent: r.photo_consent,
    semester: `${semesterLabel(r.season)} ${r.year}`,
    updatedAt: r.updated_at,
    workflow: await workflowFor(user, r),
    isLead: await isLead(user, r.class_id),
    canWriteReport: user.role === "admin" ? !!r.taken_over_by : await isLead(user, r.class_id),
    leadName: await leadName(r.class_id),
    parts: await partsView(user, r, r.rubric.areas.map((a) => a.key)),
    waitingFor: await waitingParts(r, r.rubric.areas, (await isLead(user, r.class_id)) ? user.id : null),
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

reviewsRouter.put("/reviews/:id/child", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const { chineseName } = parse(z.object({ chineseName: z.string().max(40) }), req.body);
  await setChineseName(user, id, chineseName);
  await audit(req, user.id, "child.updated", { reviewId: id });
  res.json({ ok: true });
});

/** Creates (or recreates) the whole report from the answers. */
reviewsRouter.post("/reviews/:id/report", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const r = await getReviewForUser(user, id);
  // Make sure the status reflects the latest answers before writing.
  await refreshReviewStatus(id);
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
    ...draft.paragraphs.map((p) => ({ key: p.key, title: p.title, text: p.text, flags: p.flags, stale: p.stale })),
    { key: "home", title: "Ideas to try at home (one per line)", text: draft.homeIdeas.join("\n") },
  ];
  const { data, school, reportDate } = await reportFor(r);
  const view: ReportView = {
    reviewId: r.id,
    childName: r.legal_name,
    data,
    school,
    reportDate,
    sections,
    notes: draft.notes,
    provider: draft.provider,
    workflow: await workflowFor(user, r),
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
  const { tone, request } = parse(z.object({ tone: z.enum(["Shorter", "Warmer", "Simpler"]).optional(), request: z.string().max(500).optional() }), req.body ?? {});
  res.json(await rewriteParagraph(currentUser(req), idParam(req.params.id), req.params.key, tone, request));
});

// A teacher's part: the areas they rate, their paragraph, and sending it to the lead teacher.
reviewsRouter.get("/reviews/:id/parts/:area", async (req, res) => {
  const user = currentUser(req);
  const r = await getReviewForUser(user, idParam(req.params.id));
  const area = r.rubric.areas.find((a) => a.key === req.params.area);
  if (!area) throw new HttpError(404, "Not found.");
  const { answers } = await loadAnswers(r.id, r.rubric);
  const part = (await partsView(user, r, [area.key]))[area.key];
  const data = await buildReportData(r);
  // The page shows the teacher's own paragraph, before the lead puts the report together.
  data.areas = data.areas.map((a) => (a.key === area.key ? { ...a, paragraph: part.paragraph } : a));
  const view: PartPageView = {
    reviewId: r.id,
    childName: r.legal_name,
    areaKey: area.key,
    areaName: area.name,
    data,
    school: await getSchool(),
    part,
    leadName: await leadName(r.class_id),
    locked: lockReason(user, r),
    rated: areaProgress(area, answers[area.key]).todo === 0,
  };
  res.json(view);
});

reviewsRouter.post("/reviews/:id/parts/:area/write", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const { request } = parse(z.object({ request: z.string().max(500).optional() }), req.body ?? {});
  const out = await writePart(user, id, req.params.area, request);
  if (out.ok) await audit(req, user.id, "part.written", { reviewId: id, detail: req.params.area });
  res.json(out);
});

reviewsRouter.put("/reviews/:id/parts/:area", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const { text } = parse(z.object({ text: z.string().max(3000) }), req.body);
  await savePartText(user, id, req.params.area, text);
  res.json({ ok: true });
});

reviewsRouter.post("/reviews/:id/parts/:area/send", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  await sendPart(user, id, req.params.area);
  await audit(req, user.id, "part.sent", { reviewId: id, detail: req.params.area });
  res.json({ ok: true });
});

reviewsRouter.post("/reviews/:id/parts/:area/reopen", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  await reopenPart(user, id, req.params.area);
  await audit(req, user.id, "part.reopened", { reviewId: id, detail: req.params.area });
  res.json({ ok: true });
});

reviewsRouter.get("/reviews/:id/pdf", async (req, res) => {
  const user = currentUser(req);
  const r = await getReviewForUser(user, idParam(req.params.id));
  if (!r.draft) throw new HttpError(400, "Create the report first.");
  if (r.status !== "approved") throw new HttpError(409, "This report is waiting for approval. You can download it once it is approved.", "not_approved");
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
  const area = String(req.query.area ?? "");
  const r = await getReviewForEdit(user, id, undefined, area);
  if (area !== COVER_PHOTO_KEY && !r.rubric.areas.some((a) => a.key === area)) throw new HttpError(400, "Choose the learning area (or the cover) for this photo.");
  if (!r.photo_consent) throw new HttpError(409, "This child's parents have not given photo consent, so no photos can be added. An administrator records consent on the child's profile.", "no_consent");
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, "No photo was sent.");
  await addPhoto(id, area, req.body);
  await audit(req, user.id, "photo.added", { reviewId: id, childId: r.child_id, detail: area });
  res.json({ photos: (await listPhotos(id)).map(photoView) });
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

// A child's profile photo: the administrator and the child's teachers all see and change the same one.
reviewsRouter.get("/children/:childId/photo", async (req, res) => {
  const childId = idParam(req.params.childId);
  if (!(await canSeeChild(currentUser(req), childId))) throw new HttpError(404, "Not found.");
  const bytes = await readChildPhoto(childId);
  if (!bytes) throw new HttpError(404, "Not found.");
  // The URL carries the photo's version, so it can be cached until the photo changes.
  res.set({ "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" });
  res.send(bytes);
});

reviewsRouter.put("/children/:childId/photo", express.raw({ type: "image/*", limit: "25mb" }), async (req, res) => {
  const user = currentUser(req);
  const childId = idParam(req.params.childId);
  if (!(await canSeeChild(user, childId))) throw new HttpError(404, "Not found.");
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, "No photo was sent.");
  const at = await setChildPhoto(childId, req.body);
  await audit(req, user.id, "child.photo_changed", { childId });
  res.json({ photo: childPhotoUrl(childId, at) });
});

reviewsRouter.delete("/children/:childId/photo", async (req, res) => {
  const user = currentUser(req);
  const childId = idParam(req.params.childId);
  if (!(await canSeeChild(user, childId))) throw new HttpError(404, "Not found.");
  await clearChildPhoto(childId);
  await audit(req, user.id, "child.photo_removed", { childId });
  res.json({ photo: null });
});

// A staff member's profile photo: everyone signed in sees it; the person themselves or an administrator changes it.
reviewsRouter.get("/users/:userId/photo", async (req, res) => {
  const bytes = await readUserPhoto(idParam(req.params.userId));
  if (!bytes) throw new HttpError(404, "Not found.");
  res.set({ "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" });
  res.send(bytes);
});

reviewsRouter.put("/users/:userId/photo", express.raw({ type: "image/*", limit: "25mb" }), async (req, res) => {
  const user = currentUser(req);
  const userId = idParam(req.params.userId);
  if (!canChangeUserPhoto(user, userId)) throw new HttpError(403, "Only that person or an administrator can change this photo.");
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, "No photo was sent.");
  const at = await setUserPhoto(userId, req.body);
  await audit(req, user.id, "user.photo_changed", { detail: String(userId) });
  res.json({ photo: userPhotoUrl(userId, at) });
});

reviewsRouter.delete("/users/:userId/photo", async (req, res) => {
  const user = currentUser(req);
  const userId = idParam(req.params.userId);
  if (!canChangeUserPhoto(user, userId)) throw new HttpError(403, "Only that person or an administrator can change this photo.");
  await clearUserPhoto(userId);
  await audit(req, user.id, "user.photo_removed", { detail: String(userId) });
  res.json({ photo: null });
});

reviewsRouter.delete("/reviews/:id/photos/:photoId", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const photoId = idParam(req.params.photoId);
  const photoArea = (await one<{ area_key: string | null }>("SELECT area_key FROM review_photos WHERE id = $1", [photoId]))?.area_key ?? undefined;
  const r = await getReviewForEdit(user, id, undefined, photoArea);
  if ((await photoReviewId(photoId)) !== id) throw new HttpError(404, "Not found.");
  await deletePhoto(photoId);
  await audit(req, user.id, "photo.removed", { reviewId: id, childId: r.child_id });
  res.json({ photos: (await listPhotos(id)).map(photoView) });
});

// ─── Sending the report for review (BUILT.md changes 1 and 3) ─────

reviewsRouter.post("/reviews/:id/submit", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const out = await submitForReview(user, id);
  await audit(req, user.id, "report.submitted", { reviewId: id, childId: out.childId, detail: `v${out.version}` });
  res.json({ ok: true, version: out.version });
});

reviewsRouter.post("/reviews/:id/take-back", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const out = await takeBack(user, id);
  await audit(req, user.id, "report.taken_back", { reviewId: id, childId: out.childId });
  res.json({ ok: true });
});
