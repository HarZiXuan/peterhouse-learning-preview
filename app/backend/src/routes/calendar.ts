import { Router } from "express";
import { z } from "zod";
import { CLASS_LEVEL_KEYS, type ClassLevel } from "@peterhouse/shared";
import { audit } from "../audit";
import { currentUser, requireAdmin } from "../auth";
import { idParam, parse } from "../http";
import { calendarLink, calendarView, deleteEvent, feedFor, resetCalendarLink, saveEvent } from "../domain/calendar";

/** The calendar file behind each person's private link. Google Calendar and Outlook fetch it without signing in. */
export const feedRouter = Router();

feedRouter.get("/feed/:file", async (req, res) => {
  const token = /^(.+)\.ics$/.exec(req.params.file)?.[1] ?? "";
  const ics = await feedFor(token);
  if (!ics) {
    res.status(404).type("text/plain").send("This calendar link is not valid. Open Calendar in the Learning Review for your current link.");
    return;
  }
  res.set({ "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="peterhouse.ics"' });
  res.send(ics);
});

export const calendarRouter = Router();

calendarRouter.get("/calendar", async (req, res) => {
  const { from, to } = parse(z.object({ from: z.string(), to: z.string() }), req.query);
  res.json(await calendarView(currentUser(req), from, to));
});

calendarRouter.get("/calendar/link", async (req, res) => {
  res.json(await calendarLink(currentUser(req)));
});

calendarRouter.post("/calendar/link/reset", async (req, res) => {
  const user = currentUser(req);
  const link = await resetCalendarLink(user);
  await audit(req, user.id, "calendar.link_reset");
  res.json(link);
});

const Time = z.string().regex(/^\d{2}:\d{2}$/);
const Event = z.object({
  kind: z.enum(["event", "closure", "deadline"]),
  title: z.string().max(200),
  startsOn: z.string(),
  endsOn: z.string(),
  startTime: Time.nullable(),
  endTime: Time.nullable(),
  place: z.string().max(200),
  note: z.string().max(1000),
  audience: z.enum(["school", "levels", "classes"]),
  levels: z.array(z.enum(CLASS_LEVEL_KEYS as [ClassLevel, ...ClassLevel[]])).max(5),
  classIds: z.array(z.number().int().positive()).max(100),
});

calendarRouter.post("/admin/calendar/events", requireAdmin, async (req, res) => {
  const input = parse(Event, req.body);
  const id = await saveEvent(currentUser(req), input);
  // The title stays out of the log: the log is about who changed what, and titles are free text.
  await audit(req, currentUser(req).id, "calendar.added", { detail: `#${id} ${input.kind} ${input.startsOn}` });
  res.status(201).json({ id });
});

calendarRouter.put("/admin/calendar/events/:id", requireAdmin, async (req, res) => {
  const id = idParam(req.params.id);
  const input = parse(Event, req.body);
  await saveEvent(currentUser(req), input, id);
  await audit(req, currentUser(req).id, "calendar.changed", { detail: `#${id} ${input.kind} ${input.startsOn}` });
  res.json({ ok: true });
});

calendarRouter.delete("/admin/calendar/events/:id", requireAdmin, async (req, res) => {
  const id = idParam(req.params.id);
  await deleteEvent(id);
  await audit(req, currentUser(req).id, "calendar.removed", { detail: `#${id}` });
  res.json({ ok: true });
});
