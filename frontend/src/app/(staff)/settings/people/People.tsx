"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserSummary } from "@peterhouse/shared";

async function send(method: string, path: string, body?: unknown): Promise<string | null> {
  const res = await fetch(`/api/admin${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not work.";
}

export function People({ initial, meId }: { initial: UserSummary[]; meId: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<string | null>, ok = "") {
    setBusy(true);
    setError("");
    setNotice("");
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
    else {
      setNotice(ok);
      router.refresh();
    }
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    await act(async () => {
      const err = await send("POST", "/users", {
        name: String(f.get("name")),
        email: String(f.get("email")),
        role: String(f.get("role")),
        password: String(f.get("password")),
      });
      if (!err) form.reset();
      return err;
    }, "Added. Give them the temporary password; they will choose their own at first sign-in.");
  }

  return (
    <>
      {error && <p className="error" role="alert" style={{ marginBottom: 12 }}>{error}</p>}
      {notice && <p className="notice-ok" style={{ marginBottom: 12 }}>{notice}</p>}
      <ul className="stack" style={{ listStyle: "none", padding: 0, marginBottom: 24 }}>
        {initial.map((u) => (
          <li key={u.id} className="panel row" style={{ justifyContent: "space-between", opacity: u.active ? 1 : 0.55 }}>
            <div>
              <strong>{u.name}</strong> <span className="small muted">· {u.role}{u.active ? "" : " · deactivated"}</span>
              <div className="small muted">
                {u.email} · {u.lastLoginAt ? `last signed in ${new Date(u.lastLoginAt).toLocaleString()}` : "never signed in"}
                {u.mustChangePassword ? " · must choose a password" : ""}
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button
                className="btn btn-sm"
                disabled={busy}
                onClick={() => {
                  const password = prompt(`Temporary password for ${u.name} (10+ characters). They must change it when they sign in.`);
                  if (password) void act(() => send("POST", `/users/${u.id}/reset-password`, { password }), `Password reset for ${u.name}.`);
                }}
              >
                Reset password
              </button>
              {u.id !== meId && (
                <button className="btn btn-sm btn-quiet" disabled={busy} onClick={() => act(() => send("PATCH", `/users/${u.id}`, { active: !u.active }))}>
                  {u.active ? "Deactivate" : "Reactivate"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="stack panel">
        <h2>Add a person</h2>
        <label className="field">
          <span>Name</span>
          <input className="input" name="name" required maxLength={100} />
        </label>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" name="email" required autoComplete="off" />
        </label>
        <label className="field">
          <span>Role</span>
          <select className="input" name="role" defaultValue="teacher">
            <option value="teacher">Teacher (sees their own class)</option>
            <option value="admin">Administrator (sees everything, manages people)</option>
          </select>
        </label>
        <label className="field">
          <span>Temporary password</span>
          <input className="input" name="password" type="text" minLength={10} required autoComplete="off" />
        </label>
        <button className="btn btn-primary" disabled={busy}>Add person</button>
      </form>
    </>
  );
}
