"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ChildAvatar } from "@/components/ui";

/**
 * A child's profile photo. The administrator and the child's teachers change the same one, and it is the cover of the
 * child's report.
 */
export function ChildPhoto({ childId, photo, name, size = 96 }: { childId: number; photo: string | null; name: string; size?: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [src, setSrc] = useState(photo);

  async function send(method: "PUT" | "DELETE", file?: File) {
    setBusy(true);
    try {
      const res = await fetch(`/api/children/${childId}/photo`, {
        method,
        ...(file ? { body: file, headers: { "content-type": file.type || "image/jpeg" } } : {}),
      });
      const body = (await res.json().catch(() => ({}))) as { photo?: string | null; error?: string };
      if (!res.ok) return void toast.error(body.error ?? "The photo could not be saved. Try again.");
      setSrc(body.photo ?? null);
      toast.success(file ? `Photo saved. It is also the cover of ${name}’s report.` : "Photo removed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <ChildAvatar src={src} name={name} size={size} />
      <div className="grid gap-1.5">
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void send("PUT", f);
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="photo" size={16} /> {busy ? "Saving…" : src ? "Change photo" : "Add photo"}
        </Button>
        {src && (
          <Button type="button" size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={busy} onClick={() => send("DELETE")}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
