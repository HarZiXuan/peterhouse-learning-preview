"use client";

import { useState } from "react";

export function ChangePasswordForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next = String(f.get("next") ?? "");
    if (next !== String(f.get("again") ?? "")) return setError("The two new passwords are not the same.");
    setPending(true);
    setError("");
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current: String(f.get("current") ?? ""), next }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not change the password.");
      setPending(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <form onSubmit={submit} className="login-form">
      <label className="field">
        <span>Current (temporary) password</span>
        <input className="input" name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="field">
        <span>New password</span>
        <input className="input" name="next" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <label className="field">
        <span>New password again</span>
        <input className="input" name="again" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary login-btn" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
