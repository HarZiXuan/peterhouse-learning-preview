// How the frontend's server talks to the backend. The browser's cookie is forwarded as-is, so the backend
// decides who the person is and what they may see; the frontend never holds a database connection or a secret.
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

const BACKEND = process.env.BACKEND_URL ?? "http://127.0.0.1:4100";

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string; code?: string };

/** For actions: never redirects or throws, so the caller can show the message. */
export async function apiSend<T = unknown>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BACKEND}/api${path}`, {
      method,
      headers: { cookie: (await cookies()).toString(), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, status: res.status, error: String(json.error ?? "Something went wrong."), code: json.code as string | undefined };
    return { ok: true, status: res.status, data: json as T };
  } catch {
    return { ok: false, status: 503, error: "The server could not be reached. Please try again in a moment." };
  }
}

/** For pages: sends the person to sign in, or to the not-found page, when the backend says so. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiSend<T>("GET", path);
  if (res.ok) return res.data;
  if (res.status === 401) redirect("/login");
  if (res.status === 403 && res.code === "must_change_password") redirect("/change-password");
  if (res.status === 404) notFound();
  throw new Error(res.error);
}

/** Like apiGet, but hands the 404 code back instead of rendering "not found". */
export async function apiGetOrNull<T>(path: string): Promise<{ data: T | null; code?: string }> {
  const res = await apiSend<T>("GET", path);
  if (res.ok) return { data: res.data };
  if (res.status === 401) redirect("/login");
  if (res.status === 403 && res.code === "must_change_password") redirect("/change-password");
  if (res.status === 404) return { data: null, code: res.code };
  throw new Error(res.error);
}
