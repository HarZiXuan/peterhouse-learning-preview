import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "That") => new HttpError(404, `${what} could not be found.`);

/** Validates request input; a bad shape becomes a clean 400 instead of a crash deeper in. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const res = schema.safeParse(data);
  if (!res.success) throw new HttpError(400, res.error.issues[0]?.message ?? "That request was not valid.");
  return res.data;
}

export const idParam = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, "That could not be found.");
  return n;
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? "That request was not valid." });
    return;
  }
  if (typeof err === "object" && err && "type" in err && (err as { type: string }).type === "entity.too.large") {
    res.status(413).json({ error: "That is too large." });
    return;
  }
  // Never echo internals to the browser.
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found." });
};
