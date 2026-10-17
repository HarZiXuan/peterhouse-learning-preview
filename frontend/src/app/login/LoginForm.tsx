"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@peterhouse/shared";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json().catch(() => ({}))) as { user?: SessionUser; error?: string };
      if (!res.ok || !json.user) {
        setError(json.error ?? "Could not sign in. Please try again.");
        setPending(false);
        return;
      }
      // A relative path only: never follow a link that could lead off this site.
      const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(json.user.mustChangePassword ? "/change-password" : safe);
      router.refresh();
    } catch {
      setError("The server could not be reached. Please try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="login-form">
      <label className="field">
        <span>Email</span>
        <input className="input" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" required autoFocus />
      </label>
      <label className="field">
        <span>Password</span>
        <input className="input" name="password" type="password" autoComplete="current-password" required />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary login-btn" disabled={pending}>
        {pending ? "Checking…" : "Log in"}
      </button>
    </form>
  );
}
