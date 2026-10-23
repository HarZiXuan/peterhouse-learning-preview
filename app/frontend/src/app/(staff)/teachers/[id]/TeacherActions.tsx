"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import type { UserSummary } from "@peterhouse/shared";
import { adminSend } from "@/lib/admin-client";
import { Button } from "@/components/ui/button";
import { EditPerson } from "../../settings/people/People";

/** The Edit button at the top of a teacher's page: the same dialog as on the Teachers list. */
export function TeacherActions({ user, isMe }: { user: UserSummary; isMe: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil /> Edit
      </Button>
      {open && (
        <EditPerson
          open
          onOpenChange={setOpen}
          user={user}
          isMe={isMe}
          busy={busy}
          onSave={async (p) => {
            // Send only what changed, so an unchanged role or email is never touched.
            const patch = Object.fromEntries(Object.entries({ name: p.name.trim(), email: p.email.trim(), role: isMe ? user.role : p.role }).filter(([k, v]) => v !== user[k as "name" | "email" | "role"]));
            if (Object.keys(patch).length === 0) return true;
            setBusy(true);
            const err = await adminSend("PATCH", `/users/${user.id}`, patch);
            setBusy(false);
            if (err) {
              toast.error(err);
              return false;
            }
            toast.success(`${p.name.trim()} saved.`);
            router.refresh();
            return true;
          }}
        />
      )}
    </>
  );
}
