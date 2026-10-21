"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { UserSummary } from "@peterhouse/shared";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SELECT = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

async function send(method: string, path: string, body?: unknown): Promise<string | null> {
  const res = await fetch(`/api/admin${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not work.";
}

function ResetPassword({ user, busy, onReset }: { user: UserSummary; busy: boolean; onReset: (password: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>Reset password</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onReset(password)) {
              setPassword("");
              setOpen(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Reset password for {user.name}</DialogTitle>
            <DialogDescription>Give them this temporary password. They must change it when they sign in.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`pw-${user.id}`}>Temporary password</Label>
            <Input id={`pw-${user.id}`} value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} required autoComplete="off" />
            <p className="text-xs text-muted-foreground">At least 10 characters.</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button disabled={busy}>Reset password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPerson({ user, isMe, busy, onSave }: { user: UserSummary; isMe: boolean; busy: boolean; onSave: (patch: { name: string; email: string; role: string }) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>Edit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (await onSave({ name: String(f.get("name")), email: String(f.get("email")), role: String(f.get("role")) })) setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {user.name}</DialogTitle>
            <DialogDescription>A new email becomes their sign-in. They are signed out and sign in again with it, using the same password.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`e-name-${user.id}`}>Name</Label>
            <Input id={`e-name-${user.id}`} name="name" defaultValue={user.name} required maxLength={100} />
            <p className="text-xs text-muted-foreground">Printed on the reports of their classes.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`e-email-${user.id}`}>Email</Label>
            <Input id={`e-email-${user.id}`} name="email" type="email" defaultValue={user.email} required autoComplete="off" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`e-role-${user.id}`}>Role</Label>
            <select id={`e-role-${user.id}`} name="role" className={SELECT} defaultValue={user.role} disabled={isMe}>
              <option value="teacher">Teacher (sees their own classes)</option>
              <option value="admin">Administrator (sees everything, manages people)</option>
            </select>
            {isMe ? (
              <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
            ) : (
              user.role === "teacher" && user.classes.length > 0 && <p className="text-xs text-muted-foreground">Making them an administrator takes them out of their classes: administrators see every class.</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button disabled={busy}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A teacher's classes this semester and how far their reports are. */
function TeacherClasses({ user }: { user: UserSummary }) {
  if (user.role !== "teacher" || !user.active) return null;
  if (user.classes.length === 0)
    return (
      <p className="text-sm text-destructive">
        Not in a class yet, so they see no children.{" "}
        <Link href="/classes" className="underline underline-offset-4">Place them in a class</Link>
      </p>
    );
  const { written, total } = user.progress;
  return (
    <div className="grid gap-1.5 text-sm">
      <p className="text-muted-foreground">
        {user.classes.map((k, i) => (
          <span key={k.id}>
            {i > 0 && ", "}
            <Link href={`/classes/${k.id}`} className="text-foreground underline-offset-4 hover:underline">{k.name}</Link>
            {k.role === "lead" ? " (lead)" : " (co-teacher)"}
          </span>
        ))}
      </p>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-28 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <span className="block h-full rounded-full bg-primary" style={{ width: `${total ? (100 * written) / total : 0}%` }} />
        </span>
        <span className="text-muted-foreground">{total === 0 ? "No children yet" : `${written} of ${total} reports written`}</span>
      </div>
    </div>
  );
}

export function People({ initial, meId }: { initial: UserSummary[]; meId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  /** Runs one request, reports the outcome as a toast, and refreshes the list on success. */
  async function act(fn: () => Promise<string | null>, ok = ""): Promise<boolean> {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    if (err) {
      toast.error(err);
      return false;
    }
    if (ok) toast.success(ok);
    router.refresh();
    return true;
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
    }, f.get("role") === "teacher" ? "Added. Give them the temporary password, then place them in a class on the Classes page." : "Added. Give them the temporary password; they choose their own at first sign-in.");
  }

  return (
    <div className="grid gap-6">
      <ul className="grid gap-3">
        {initial.map((u) => (
          <li key={u.id}>
            <Card className={`flex-row flex-wrap items-center justify-between gap-3 px-5 py-4 shadow-none ${u.active ? "" : "opacity-60"}`}>
              <div className="grid min-w-0 gap-1.5">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {u.name}
                  <Badge variant="outline" className="font-normal">{u.role === "admin" ? "Administrator" : "Teacher"}</Badge>
                  {!u.active && <Badge variant="secondary">Deactivated</Badge>}
                  {u.lockedUntil && <Badge variant="destructive">Locked until {new Date(u.lockedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Badge>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {u.email} · {u.lastLoginAt ? `last signed in ${new Date(u.lastLoginAt).toLocaleString()}` : "never signed in"}
                  {u.mustChangePassword ? " · must choose a password" : ""}
                </p>
                <TeacherClasses user={u} />
              </div>
              <div className="flex flex-wrap gap-2">
                {u.lockedUntil && (
                  <Button size="sm" disabled={busy} onClick={() => act(() => send("POST", `/users/${u.id}/unlock`), `${u.name} can sign in again.`)}>
                    Unlock
                  </Button>
                )}
                <EditPerson
                  user={u}
                  isMe={u.id === meId}
                  busy={busy}
                  onSave={(p) => {
                    // Send only what changed, so an unchanged role or email is never touched.
                    const patch = Object.fromEntries(Object.entries({ name: p.name.trim(), email: p.email.trim(), role: u.id === meId ? u.role : p.role }).filter(([k, v]) => v !== u[k as "name" | "email" | "role"]));
                    if (Object.keys(patch).length === 0) return Promise.resolve(true);
                    return act(() => send("PATCH", `/users/${u.id}`, patch), "email" in patch ? `${p.name.trim()} saved. They sign in with ${p.email.trim()} from now on.` : `${p.name.trim()} saved.`);
                  }}
                />
                <ResetPassword user={u} busy={busy} onReset={(password) => act(() => send("POST", `/users/${u.id}/reset-password`, { password }), `Password reset for ${u.name}.`)} />
                {u.id !== meId &&
                  (u.active ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={busy}>Deactivate</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deactivate {u.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            They are signed out at once and cannot sign in. Everything they wrote is kept, and you can reactivate them later.
                            {u.classes.length > 0 && ` ${u.classes.map((k) => k.name).join(", ")} will show without them, so choose another teacher there.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep {u.name}</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => act(() => send("PATCH", `/users/${u.id}`, { active: false }), `${u.name} is deactivated and signed out.`)}>
                            Deactivate
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(() => send("PATCH", `/users/${u.id}`, { active: true }), `${u.name} can sign in again.`)}>
                      Reactivate
                    </Button>
                  ))}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="font-heading text-xl font-semibold">Add a person</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" name="name" required maxLength={100} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" type="email" name="email" required autoComplete="off" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-role">Role</Label>
              <select id="p-role" className={SELECT} name="role" defaultValue="teacher">
                <option value="teacher">Teacher (sees their own class)</option>
                <option value="admin">Administrator (sees everything, manages people)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-pw">Temporary password</Label>
              <Input id="p-pw" name="password" type="text" minLength={10} required autoComplete="off" />
            </div>
            <Button disabled={busy} className="justify-self-start">Add person</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
