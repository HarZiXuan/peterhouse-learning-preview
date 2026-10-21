// For administrator screens in the browser: one request to /api/admin, the backend's message on failure.
export async function adminSend(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<string | null> {
  const res = await fetch(`/api/admin${path}`, { method, headers: body !== undefined ? { "content-type": "application/json" } : {}, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not work.";
}
