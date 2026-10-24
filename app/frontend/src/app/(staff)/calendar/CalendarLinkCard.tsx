"use client";

import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** This person's private calendar link, with buttons to add it to Google Calendar or Outlook. */
export function CalendarLinkCard({ path: initial, admin }: { path: string; admin: boolean }) {
  const [path, setPath] = useState(initial);
  // The address people reach the app by (the school's server, not this computer), known only in the browser.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const url = origin + path;
  const local = /\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin);
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(url.replace(/^https?:/, "webcal:"))}`;
  const outlook = `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent("Peterhouse")}`;

  async function reset() {
    const res = await fetch("/api/calendar/link/reset", { method: "POST" });
    if (!res.ok) return void toast.error("The link could not be reset.");
    setPath(((await res.json()) as { path: string }).path);
    toast.success("New link ready. Add it to your calendar again; the old one has stopped working.");
  }

  return (
    <Card className="mt-8 gap-3 px-5 py-5 shadow-none">
      <p className="flex items-center gap-2 font-heading text-lg font-semibold">
        <Icon name="calendar" size={19} /> Put this calendar in Google Calendar or Outlook
      </p>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Your own private link: it shows {admin ? "everything on the calendar" : "your classes and the whole-school entries"}, and your calendar app keeps it up to date (Google refreshes every few hours). Set
        reminders there, for example a day before. Keep the link to yourself.
      </p>
      {local && <p className="rounded-md border border-warn/60 bg-warn/10 px-3 py-2 text-sm">This copy runs on this computer, so Google and Outlook cannot reach it. The buttons work on the school’s server.</p>}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={google} target="_blank" rel="noreferrer">
            Add to Google Calendar
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={outlook} target="_blank" rel="noreferrer">
            Add to Outlook
          </a>
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(url).catch(() => {});
            toast.success("Link copied. Paste it where your calendar app asks to subscribe by URL.");
          }}
        >
          Copy link
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input readOnly value={url} aria-label="Your calendar link" className="h-8 max-w-xl flex-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Reset link
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset your calendar link?</AlertDialogTitle>
              <AlertDialogDescription>Do this if the link was shared by mistake. The old link stops working at once, so you will add the new one to your calendar again.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={reset}>Reset link</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}
