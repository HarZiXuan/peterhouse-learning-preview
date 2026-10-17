import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { requireAuth, sameOriginOnly } from "./auth";
import { pool } from "./db";
import { errorHandler, notFoundHandler } from "./http";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { reviewsRouter } from "./routes/reviews";
import { workspaceRouter } from "./routes/workspace";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // One reverse proxy (nginx) sits in front: trust its X-Forwarded-* so logs and rate limits see real client addresses.
  app.set("trust proxy", 1);
  app.use(helmet());

  app.get("/healthz", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  });

  const api = express.Router();
  api.use((_req, res, next) => {
    // Everything here is private: browsers and proxies must not keep a copy.
    res.set("Cache-Control", "no-store");
    next();
  });
  api.use(rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  api.use(sameOriginOnly);
  api.use(express.json({ limit: "1mb" }));
  api.use("/auth", authRouter);
  api.use(requireAuth);
  api.use("/admin", adminRouter);
  api.use(workspaceRouter);
  api.use(reviewsRouter);
  api.use(notFoundHandler);

  app.use("/api", api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
