"use server";

// Thin server actions: each one asks the backend to do the work as the signed-in person.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AreaAnswer, ReviewPhoto, ReviewView, SaveResult, WriteOutcome } from "@peterhouse/shared";
import { apiSend } from "@/lib/api";

const failed = (e: string) => ({ ok: false as const, error: e });

export async function removeChildAction(reviewId: number) {
  const res = await apiSend("DELETE", `/reviews/${reviewId}`);
  revalidatePath("/", "layout");
  return res.ok ? { ok: true as const } : failed(res.error);
}

export async function saveAreaAction(reviewId: number, areaKey: string, answer: AreaAnswer): Promise<SaveResult> {
  const res = await apiSend<SaveResult>("PUT", `/reviews/${reviewId}/areas/${encodeURIComponent(areaKey)}`, answer);
  return res.ok ? res.data : failed(res.error);
}

export async function saveChineseNameAction(reviewId: number, chineseName: string) {
  const res = await apiSend("PUT", `/reviews/${reviewId}/child`, { chineseName });
  revalidatePath(`/child/${reviewId}`);
  return res.ok ? { ok: true as const } : failed(res.error);
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
    season: formData.get("season") === "December" ? "December" : "June",
    year: Number.isInteger(year) ? year : new Date().getFullYear(),
  });
  redirect(res.ok ? "/settings/report?saved=1" : "/settings/report?error=1");
}

export async function deletePhotoAction(reviewId: number, photoId: number) {
  const res = await apiSend<{ photos: ReviewPhoto[] }>("DELETE", `/reviews/${reviewId}/photos/${photoId}`);
  revalidatePath(`/child/${reviewId}`);
  if (res.ok) return { ok: true as const, photos: res.data.photos };
  // Could not remove it: show what is really there rather than an empty list.
  const now = await apiSend<ReviewView>("GET", `/reviews/${reviewId}`);
  return { ok: false as const, error: res.error, photos: now.ok ? now.data.photos : [] };
}

export async function openPeriodAction(semester: 1 | 2, year: number) {
  const res = await apiSend("PUT", "/terms/current", { semester, year });
  revalidatePath("/", "layout");
  redirect(res.ok ? "/settings/semester?saved=1" : `/settings/semester?error=${encodeURIComponent(res.error)}`);
}

// ─── Admin: questions ────────────────────────────────────────────────────

type Done = { ok: true; key?: string } | { ok: false; error: string };

async function admin(method: "POST" | "PUT", path: string, body?: unknown): Promise<Done> {
  const res = await apiSend<{ key?: string }>(method, `/admin${path}`, body);
  revalidatePath("/reports", "layout");
  return res.ok ? { ok: true, key: res.data.key } : failed(res.error);
}

export const addQuestionAction = async (areaKey: string, text: string, levels?: string[]) => admin("POST", "/questions", { areaKey, text, levels });
export const setQuestionLevelsAction = async (key: string, levels: string[]) => admin("PUT", `/questions/${encodeURIComponent(key)}/levels`, { levels });
export const rewordQuestionAction = async (key: string, text: string, sameSkill: boolean) => admin("PUT", `/questions/${encodeURIComponent(key)}`, { text, sameSkill });
export const retireQuestionAction = async (key: string) => admin("POST", `/questions/${encodeURIComponent(key)}/retire`);
export const restoreQuestionAction = async (key: string) => admin("POST", `/questions/${encodeURIComponent(key)}/restore`);
export const moveQuestionAction = async (key: string, direction: "up" | "down") => admin("POST", `/questions/${encodeURIComponent(key)}/move`, { direction });
export const updateDomainAction = async (areaKey: string, patch: { loveText?: string; homeIdeas?: string[] }) => admin("PUT", `/domains/${encodeURIComponent(areaKey)}`, patch);
export const discardQuestionsAction = async () => admin("POST", "/questions/discard");

export async function publishQuestionsAction(): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const res = await apiSend<{ version: number; changes: number }>("POST", "/admin/questions/publish");
  revalidatePath("/reports", "layout");
  return res.ok ? { ok: true, version: res.data.version } : failed(res.error);
}

// ─── Sending reports for review, and approving them (changes 1 and 3) ──────

async function workflow(path: string, body?: unknown) {
  const res = await apiSend("POST", path, body);
  revalidatePath("/", "layout");
  return res.ok ? { ok: true as const } : failed(res.error);
}

export const submitForReviewAction = async (reviewId: number) => workflow(`/reviews/${reviewId}/submit`);
export const takeBackAction = async (reviewId: number) => workflow(`/reviews/${reviewId}/take-back`);
export const approveAction = async (reviewId: number) => workflow(`/admin/reviews/${reviewId}/approve`);
export const requestChangesAction = async (reviewId: number, note: string) => workflow(`/admin/reviews/${reviewId}/request-changes`, { note });
export const takeOverAction = async (reviewId: number) => workflow(`/admin/reviews/${reviewId}/take-over`);
