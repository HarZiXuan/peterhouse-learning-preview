"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import * as R from "@/lib/reviews";
import { addChild, removeChild, setReportPeriod } from "@/lib/workspace";
import { deletePhoto, listPhotos, setPhotoConsent } from "@/lib/photos";
import { getSchool, setSchool } from "@/lib/school";
import type { AreaAnswer, Pronoun } from "@/lib/types";

export async function addChildAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const pronoun = (["she", "he", "they"].includes(String(formData.get("pronoun"))) ? formData.get("pronoun") : "she") as Pronoun;
  const dob = String(formData.get("dob") ?? "");
  let id: number;
  try {
    id = addChild(name, pronoun, /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : "");
  } catch {
    redirect("/");
  }
  redirect(`/child/${id}`);
}

export async function removeChildAction(reviewId: number) {
  removeChild(reviewId);
  revalidatePath("/");
}

export async function saveAreaAction(reviewId: number, areaKey: string, answer: AreaAnswer) {
  const user = await requireUser();
  try {
    return R.saveArea(user, reviewId, areaKey, answer, null, true);
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not save." };
  }
}

export async function saveNoteAction(reviewId: number, key: string, text: string) {
  const user = await requireUser();
  try {
    return R.saveNote(user, reviewId, key, text);
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not save." };
  }
}

export async function saveHighlightAction(reviewId: number, text: string) {
  const user = await requireUser();
  try {
    return R.saveHighlight(user, reviewId, text);
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not save." };
  }
}

/** Creates (or recreates) the whole report from the answers. */
export async function createReportAction(reviewId: number) {
  const user = await requireUser();
  try {
    // Make sure the status reflects the latest answers before writing.
    R.saveHighlight(user, reviewId, R.getReviewRow(reviewId)?.highlight ?? "");
    const res = await R.writeDraft(user, reviewId);
    revalidatePath(`/child/${reviewId}/report`);
    return res;
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "The report could not be written." };
  }
}

export async function editTextAction(reviewId: number, key: string, text: string) {
  const user = await requireUser();
  try {
    R.editParagraph(user, reviewId, key, text);
    revalidatePath(`/child/${reviewId}/report`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not save." };
  }
}

export async function rewriteSectionAction(reviewId: number, key: string, tone?: string) {
  const user = await requireUser();
  try {
    const res = await R.rewriteParagraph(user, reviewId, key, tone);
    revalidatePath(`/child/${reviewId}/report`);
    return res;
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Could not rewrite." };
  }
}

export async function saveSettingsAction(formData: FormData) {
  const s = getSchool();
  setSchool({
    ...s,
    name: String(formData.get("school") ?? s.name).trim() || s.name,
    teachers: String(formData.get("teachers") ?? "").trim(),
    className: String(formData.get("className") ?? "").trim(),
  });
  const season = formData.get("season") === "December" ? "December" : "June";
  const year = Number(formData.get("year"));
  if (Number.isInteger(year) && year > 2000 && year < 2100) setReportPeriod(season, year);

  redirect("/settings?saved=1");
}

export async function deletePhotoAction(reviewId: number, photoId: number) {
  await requireUser();
  deletePhoto(photoId);
  revalidatePath(`/child/${reviewId}`);
  return { photos: listPhotos(reviewId) };
}

export async function setPhotoConsentAction(reviewId: number, consent: boolean) {
  await requireUser();
  setPhotoConsent(reviewId, consent);
  revalidatePath(`/child/${reviewId}`);
}
