"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** With `stay`, the person is changing a password they chose (from My account) and stays on the page. */
export function ChangePasswordForm({ stay = false }: { stay?: boolean }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
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
    if (!stay) return void (window.location.href = "/");
    setPending(false);
    setDone(true);
    form.reset();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" onChange={() => setDone(false)}>
      <div className="grid gap-2">
        <Label htmlFor="current">{stay ? "Current password" : "Current (temporary) password"}</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="next">New password</Label>
        <Input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required />
        <p className="text-xs text-muted-foreground">At least 10 characters.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="again">New password again</Label>
        <Input id="again" name="again" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {done && (
        <Alert role="status">
          <AlertDescription>Password changed. Your other devices have been signed out.</AlertDescription>
        </Alert>
      )}
      <Button disabled={pending} className={stay ? "justify-self-start" : "w-full"}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
