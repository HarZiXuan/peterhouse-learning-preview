"use server";

// Thin server actions: each one asks the backend to do the work as the signed-in person.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AreaAnswer, ReviewView, SaveResult, WriteOutcome } from "@peterhouse/shared";
import { apiSend } from "@/lib/api";

const failed = (e: string) => ({ ok: false as const, error: e });

export async function addChildAction(formData: FormData) {
  const pronoun = ["she", "he", "they"].includes(String(formData.get("pronoun"))) ? String(formData.get("pronoun")) : "she";
  const dob = String(formData.get("dob") ?? "");
  const res = await apiSend<{ reviewId: number }>("POST", "/children", {
    name: String(formData.get("name") ?? ""),
    pronoun,
    dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : "",
  });
  if (!res.ok) redirect("/");
  redirect(`/child/${res.data.reviewId}`);
}

export async function removeChildAction(reviewId: number) {
  await apiSend("DELETE", `/reviews/${reviewId}`);
  revalidatePath("/");
}

export async function saveAreaAction(reviewId: number, areaKey: string, answer: AreaAnswer): Promise<SaveResult> {
  const res = await apiSend<SaveResult>("PUT", `/reviews/${reviewId}/areas/${encodeURIComponent(areaKey)}`, answer);
  return res.ok ? res.data : failed(res.error);
}

export async function saveNoteAction(reviewId: number, key: string, text: string): Promise<SaveResult> {
  const res = await apiSend<SaveResult>("PUT", `/reviews/${reviewId}/notes/${encodeURIComponent(key)}`, { text });
  return res.ok ? res.data : failed(res.error);
}

export async function saveHighlightAction(reviewId: number, text: string): Promise<SaveResult> {
  const res = await apiSend<SaveResult>("PUT", `/reviews/${reviewId}/highlight`, { text });
  return res.ok ? res.data : failed(res.error);
}

/** Creates (or recreates) the whole report from the answers. */
export async function createReportAction(reviewId: number): Promise<WriteOutcome> {
  const res = await apiSend<WriteOutcome>("POST", `/reviews/${reviewId}/report`);
  revalidatePath(`/child/${reviewId}/report`);
  return res.ok ? res.data : failed(res.error);
}

export async function editTextAction(reviewId: number, key: string, text: string) {
  const res = await apiSend("PUT", `/reviews/${reviewId}/paragraphs/${encodeURIComponent(key)}`, { text });
  if (res.ok) revalidatePath(`/child/${reviewId}/report`);
  return res.ok ? { ok: true as const } : failed(res.error);
}

export async function rewriteSectionAction(reviewId: number, key: string, tone?: string): Promise<WriteOutcome> {
  const res = await apiSend<WriteOutcome>("POST", `/reviews/${reviewId}/paragraphs/${encodeURIComponent(key)}/rewrite`, tone ? { tone } : {});
  if (res.ok) revalidatePath(`/child/${reviewId}/report`);
  return res.ok ? res.data : failed(res.error);
}

export async function saveSettingsAction(formData: FormData) {
  const year = Number(formData.get("year"));
  const res = await apiSend("PUT", "/settings", {
    name: String(formData.get("school") ?? ""),
    teachers: String(formData.get("teachers") ?? ""),
    className: String(formData.get("className") ?? ""),
    season: formData.get("season") === "December" ? "December" : "June",
    year: Number.isInteger(year) ? year : new Date().getFullYear(),
  });
  redirect(res.ok ? "/settings?saved=1" : "/settings?error=1");
}

export async function deletePhotoAction(reviewId: number, photoId: number) {
  const res = await apiSend<{ photos: { id: number }[] }>("DELETE", `/reviews/${reviewId}/photos/${photoId}`);
  revalidatePath(`/child/${reviewId}`);
  if (res.ok) return { photos: res.data.photos };
  // Could not remove it: show what is really there rather than an empty list.
  const now = await apiSend<ReviewView>("GET", `/reviews/${reviewId}`);
  return { photos: now.ok ? now.data.photos : [] };
}

export async function setPhotoConsentAction(reviewId: number, consent: boolean) {
  await apiSend("PUT", `/reviews/${reviewId}/photo-consent`, { consent });
  revalidatePath(`/child/${reviewId}`);
}

export async function startNextSemesterAction() {
  const res = await apiSend("POST", "/terms/next");
  redirect(res.ok ? "/settings?saved=1" : `/settings?error=${encodeURIComponent(res.error)}`);
}
