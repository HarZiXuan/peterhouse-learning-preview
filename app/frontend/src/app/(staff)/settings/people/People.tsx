"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ellipsis, Plus } from "lucide-react";
import type { UserSummary } from "@peterhouse/shared";
import { timeAgo } from "@/components/ui";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { SUBJECT_TINT } from "@/lib/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { EmptyTable, SearchBox, SortHead, STICKY_CELL, useSort, type Column } from "@/components/sort-table";
import { cn } from "@/lib/utils";

const SELECT = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
const ROLE_TEXT = { lead: "lead", co: "co-teacher" } as const;

async function send(method: string, path: string, body?: unknown): Promise<string | null> {
  const res = await fetch(`/api/admin${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not work.";
}

/** Runs one request, reports the outcome as a toast, and refreshes the list on success. */
function useAct() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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
  return { busy, act };
}

type Open = { open: boolean; onOpenChange: (open: boolean) => void };

/** The button above the table, and its form. On the Teachers page (`teacher`) it adds a teacher only. */
export function AddPerson({ teacher = false }: { teacher?: boolean }) {
  const { busy, act } = useAct();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="h-10 px-5 font-semibold" onClick={() => setOpen(true)}>
        <Plus /> {teacher ? "Add teacher" : "Add person"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const role = teacher ? "teacher" : String(f.get("role"));
              const done = await act(
                () => send("POST", "/users", { name: String(f.get("name")), email: String(f.get("email")), role, password: String(f.get("password")) }),
                role === "teacher" ? "Added. Give them the temporary password, then place them in a class on the Classes page." : "Added. Give them the temporary password; they choose their own at first sign-in.",
              );
              if (done) setOpen(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>{teacher ? "Add a teacher" : "Add a person"}</DialogTitle>
              <DialogDescription>They sign in with this email and the temporary password, then choose their own.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" name="name" required maxLength={100} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" type="email" name="email" required autoComplete="off" />
            </div>
            {!teacher && (
              <div className="grid gap-2">
                <Label htmlFor="p-role">Role</Label>
                <select id="p-role" className={SELECT} name="role" defaultValue="teacher">
                  <option value="teacher">Teacher (sees their own class)</option>
                  <option value="admin">Administrator (sees everything, manages people)</option>
                </select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="p-pw">Temporary password</Label>
              <Input id="p-pw" name="password" type="text" minLength={10} required autoComplete="off" />
              <p className="text-xs text-muted-foreground">At least 10 characters.</p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button disabled={busy}>Add person</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResetPassword({ user, busy, onReset, ...dialog }: { user: UserSummary; busy: boolean; onReset: (password: string) => Promise<boolean> } & Open) {
  const [password, setPassword] = useState("");
  return (
    <Dialog {...dialog}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onReset(password)) {
              setPassword("");
              dialog.onOpenChange(false);
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

function EditPerson({ user, isMe, busy, onSave, ...dialog }: { user: UserSummary; isMe: boolean; busy: boolean; onSave: (patch: { name: string; email: string; role: string }) => Promise<boolean> } & Open) {
  return (
    <Dialog {...dialog}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (await onSave({ name: String(f.get("name")), email: String(f.get("email")), role: String(f.get("role")) })) dialog.onOpenChange(false);
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

/** One word for where the account stands, most urgent first. */
function statusOf(u: UserSummary): { label: string; order: number; tone: string } {
  if (!u.active) return { label: "Deactivated", order: 4, tone: "bg-secondary text-muted-foreground" };
  if (u.lockedUntil) return { label: `Locked until ${new Date(u.lockedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`, order: 0, tone: "bg-destructive/15 text-destructive" };
  if (u.role === "teacher" && u.classes.length === 0) return { label: "Not in a class", order: 1, tone: "bg-warn/15 text-warn-foreground" };
  if (u.mustChangePassword) return { label: "New password needed", order: 2, tone: "bg-warn/15 text-warn-foreground" };
  return { label: "Active", order: 3, tone: "bg-success/15 text-success" };
}

/** What a teacher teaches, once per subject, with the classes it is in. A lead or co-teacher with no subjects tagged in a class teaches all of them there. */
function subjectsOf(u: UserSummary) {
  const out = new Map<string, { name: string; color: string; in: string[] }>();
  for (const k of u.classes) {
    const at = `${k.name} (${k.role === "subject" ? "subject teacher" : ROLE_TEXT[k.role]})`;
    for (const x of k.subjects?.length ? k.subjects : k.role === "subject" ? [] : [{ name: "All subjects", color: "" }]) {
      const e = out.get(x.name) ?? { ...x, in: [] };
      e.in.push(at);
      out.set(x.name, e);
    }
  }
  return [...out.values()];
}

/** The first class on one line; with more, "+2" says so and hovering lists the rest with the teacher's role in each. */
function ClassesCell({ classes }: { classes: UserSummary["classes"] }) {
  const roleOf = (k: UserSummary["classes"][number]) => (k.role === "subject" ? "subject teacher" : ROLE_TEXT[k.role]);
  const [first, ...rest] = classes;
  return (
    <span className="flex items-baseline gap-x-2 whitespace-nowrap">
      <Link href={`/classes/${first.id}`} className="font-semibold text-foreground underline-offset-4 hover:underline">
        {first.name}
      </Link>
      <span className="text-[13px] text-muted-foreground">{roleOf(first)}</span>
      {rest.length > 0 && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="cursor-default rounded-full bg-secondary px-2 py-0.5 text-[13px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                +{rest.length}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {rest.map((k) => (
                <p key={k.id}>
                  <span className="font-semibold">{k.name}</span> · {roleOf(k)}
                </p>
              ))}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  );
}

/** The subjects in their own colours; hovering one says which classes it is taught in. */
function SubjectPills({ user }: { user: UserSummary }) {
  const subjects = user.role === "admin" ? [] : subjectsOf(user);
  if (subjects.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <TooltipProvider delayDuration={100}>
      <span className="flex flex-wrap gap-1">
        {subjects.map((x) => (
          <Tooltip key={x.name}>
            <TooltipTrigger asChild>
              <span tabIndex={0} className={cn("cursor-default whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[13px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", x.color ? (SUBJECT_TINT[x.color] ?? SUBJECT_TINT.stone) : "bg-secondary text-foreground")}>
                {x.name}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold">{x.name === "All subjects" ? "Teaches every subject in" : `${x.name} in`}</p>
              {x.in.map((c) => (
                <p key={c}>{c}</p>
              ))}
            </TooltipContent>
          </Tooltip>
        ))}
      </span>
    </TooltipProvider>
  );
}

type Dialogs = { kind: "edit" | "reset" | "deactivate"; user: UserSummary } | null;

/** Everyone with an account (Settings → People), or with `teachersOnly` just the teachers (the Teachers page). */
export function People({ initial, meId, teachersOnly = false }: { initial: UserSummary[]; meId: number; teachersOnly?: boolean }) {
  const { busy, act } = useAct();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>(teachersOnly ? "teacher" : "");
  const [classId, setClassId] = useState("");
  const [dialog, setDialog] = useState<Dialogs>(null);
  const close = (o: boolean) => !o && setDialog(null);

  const columns: Column<UserSummary>[] = [
    { key: "name", label: "Name", sort: (u) => u.name },
    ...(teachersOnly ? [] : [{ key: "role", label: "Role", sort: (u: UserSummary) => u.role }]),
    { key: "classes", label: "Classes", sort: (u) => u.classes.map((k) => k.name).join(", ") || "~" },
    { key: "subjects", label: "Subjects", sort: (u) => subjectsOf(u).map((x) => x.name).join(", ") || "~" },
    { key: "login", label: "Last sign-in", sort: (u) => u.lastLoginAt ?? "" },
    { key: "status", label: "Status", sort: (u) => statusOf(u).order },
    { key: "actions", label: "Actions" },
  ];
  // Every class someone teaches in, for the class filter.
  const classes = [...new Map(initial.flatMap((u) => u.classes.map((k) => [k.id, k.name] as const))).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const shown = initial.filter(
    (u) => `${u.name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()) && (!role || u.role === role) && (!classId || u.classes.some((k) => k.id === Number(classId))),
  );
  const { sorted, sort, toggle } = useSort(shown, columns);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} label="Search people by name or email" />
        {!teachersOnly && (
          <select aria-label="Role" className={cn(SELECT, "w-auto min-w-40")} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Everyone</option>
            <option value="teacher">Teachers</option>
            <option value="admin">Administrators</option>
          </select>
        )}
        {classes.length > 0 && (
          <select aria-label="Class" className={cn(SELECT, "w-auto min-w-40")} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">All classes</option>
            {classes.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyTable title="No one matches" text="Try a different name or clear the filter." />
      ) : (
        <Card className="overflow-hidden p-0 shadow-none">
          <Table>
            <SortHead columns={columns} sort={sort} toggle={toggle} />
            <TableBody>
              {sorted.map((u) => {
                const st = statusOf(u);
                return (
                  <TableRow key={u.id} className={cn(!u.active && "text-muted-foreground")}>
                    <TableCell className={cn(STICKY_CELL, "py-3")}>
                      <p className="font-heading text-base font-semibold">
                        {u.role === "teacher" ? (
                          <Link href={`/teachers/${u.id}`} className="underline-offset-4 hover:underline">
                            {u.name}
                          </Link>
                        ) : (
                          u.name
                        )}
                        {u.id === meId && <span className="ml-1.5 text-sm font-normal text-muted-foreground">(you)</span>}
                      </p>
                      <p className="text-[13px] text-muted-foreground">{u.email}</p>
                    </TableCell>
                    {!teachersOnly && <TableCell className="whitespace-nowrap">{u.role === "admin" ? "Administrator" : "Teacher"}</TableCell>}
                    <TableCell>
                      {u.role === "admin" ? (
                        <span className="text-muted-foreground">All classes</span>
                      ) : u.classes.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <ClassesCell classes={u.classes} />
                      )}
                    </TableCell>
                    <TableCell>
                      <SubjectPills user={u} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</TableCell>
                    <TableCell>
                      <Badge className={cn("whitespace-nowrap border-transparent font-normal", st.tone)}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`Options for ${u.name}`}>
                            <Ellipsis />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {u.lockedUntil && <DropdownMenuItem onSelect={() => act(() => send("POST", `/users/${u.id}/unlock`), `${u.name} can sign in again.`)}>Unlock</DropdownMenuItem>}
                          <DropdownMenuItem onSelect={() => setDialog({ kind: "edit", user: u })}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDialog({ kind: "reset", user: u })}>Reset password</DropdownMenuItem>
                          {u.id !== meId && (
                            <>
                              <DropdownMenuSeparator />
                              {u.active ? (
                                <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ kind: "deactivate", user: u })}>Deactivate</DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onSelect={() => act(() => send("PATCH", `/users/${u.id}`, { active: true }), `${u.name} can sign in again.`)}>Reactivate</DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {dialog?.kind === "edit" && (
        <EditPerson
          open
          onOpenChange={close}
          user={dialog.user}
          isMe={dialog.user.id === meId}
          busy={busy}
          onSave={(p) => {
            const u = dialog.user;
            // Send only what changed, so an unchanged role or email is never touched.
            const patch = Object.fromEntries(Object.entries({ name: p.name.trim(), email: p.email.trim(), role: u.id === meId ? u.role : p.role }).filter(([k, v]) => v !== u[k as "name" | "email" | "role"]));
            if (Object.keys(patch).length === 0) return Promise.resolve(true);
            return act(() => send("PATCH", `/users/${u.id}`, patch), "email" in patch ? `${p.name.trim()} saved. They sign in with ${p.email.trim()} from now on.` : `${p.name.trim()} saved.`);
          }}
        />
      )}
      {dialog?.kind === "reset" && (
        <ResetPassword open onOpenChange={close} user={dialog.user} busy={busy} onReset={(password) => act(() => send("POST", `/users/${dialog.user.id}/reset-password`, { password }), `Password reset for ${dialog.user.name}.`)} />
      )}
      {dialog?.kind === "deactivate" && (
        <AlertDialog open onOpenChange={close}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {dialog.user.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                They are signed out at once and cannot sign in. Everything they wrote is kept, and you can reactivate them later.
                {dialog.user.classes.length > 0 && ` ${dialog.user.classes.map((k) => k.name).join(", ")} will show without them, so choose another teacher there.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep {dialog.user.name}</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => act(() => send("PATCH", `/users/${dialog.user.id}`, { active: false }), `${dialog.user.name} is deactivated and signed out.`)}>
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
