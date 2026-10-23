"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChildAvatar } from "@/components/ui";

/**
 * The layout every "edit a person" dialog shares: a title bar, a banner with the person's photo, the fields, and a
 * Cancel / Save bar. Put it directly inside `DialogContent` (with `ProfileDialogContent`'s classes).
 */
export const PROFILE_DIALOG = "gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl sm:max-w-xl";

export function ProfileForm({
  title,
  description,
  photo,
  onSubmit,
  busy,
  saveLabel = "Save changes",
  disabled = false,
  children,
}: {
  title: string;
  description?: string;
  /** Shown under the title bar. Leave out for a dialog with no photo. */
  photo?: React.ReactNode;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  saveLabel?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <form className="flex max-h-[90dvh] flex-col" onSubmit={onSubmit}>
      <DialogHeader className="border-b border-border/60 px-7 py-5 pr-14">
        <DialogTitle className="font-heading text-xl">{title}</DialogTitle>
        {description ? <DialogDescription className="text-sm">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {photo}
        <div className="grid gap-6 px-7 pb-7 pt-5 [&_input:not([type=checkbox]):not([type=radio])]:h-11 [&_input:not([type=checkbox]):not([type=radio])]:rounded-lg [&_label]:font-semibold [&_select]:h-11 [&_select]:rounded-lg">{children}</div>
      </div>
      <DialogFooter className="border-t border-border/60 bg-muted/20 px-7 py-4">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="h-10 px-5 font-semibold">
            Cancel
          </Button>
        </DialogClose>
        <Button className="h-10 px-5 font-semibold" disabled={busy || disabled}>
          {saveLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * A banner across the top of the form with the person's photo sitting on its lower edge. The camera button changes the
 * photo and the cross removes it; both save straight away, like the photo on a profile page.
 */
export function ProfilePhoto({ endpoint, photo, name, okMessage }: { endpoint: string; photo: string | null; name: string; okMessage?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [src, setSrc] = useState(photo);

  async function send(method: "PUT" | "DELETE", file?: File) {
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method,
        ...(file ? { body: file, headers: { "content-type": file.type || "image/jpeg" } } : {}),
      });
      const body = (await res.json().catch(() => ({}))) as { photo?: string | null; error?: string };
      if (!res.ok) return void toast.error(body.error ?? "The photo could not be saved. Try again.");
      setSrc(body.photo ?? null);
      toast.success(file ? (okMessage ?? "Photo saved.") : "Photo removed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mb-12 h-32 bg-gradient-to-br from-primary/25 via-primary/10 to-secondary">
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
      <div className="absolute -bottom-10 left-7 flex items-end gap-3">
        <div className="relative rounded-full bg-background p-1">
          <ChildAvatar src={src} name={name} size={80} />
          <button
            type="button"
            disabled={busy}
            aria-label={src ? "Change photo" : "Add a photo"}
            title={src ? "Change photo" : "Add a photo"}
            onClick={() => input.current?.click()}
            className="absolute inset-1 grid place-items-center rounded-full bg-black/0 text-white opacity-0 outline-none transition hover:bg-black/45 hover:opacity-100 focus-visible:bg-black/45 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-wait [@media(hover:none)]:bg-black/35 [@media(hover:none)]:opacity-100"
          >
            <ImagePlus className="size-6" />
          </button>
        </div>
        {src && (
          <Button type="button" variant="outline" size="xs" className="mb-1 bg-background text-muted-foreground hover:text-destructive" disabled={busy} onClick={() => send("DELETE")}>
            <X /> Remove photo
          </Button>
        )}
      </div>
      {busy && <p className="absolute bottom-2 right-4 text-xs font-medium text-muted-foreground">Saving…</p>}
    </div>
  );
}
