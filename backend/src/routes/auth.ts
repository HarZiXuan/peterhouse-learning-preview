import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config";
import { audit } from "../audit";
import { clearSessionCookie, createSession, currentUser, destroySession, readCookie, requireSession, SESSION_COOKIE, setSessionCookie } from "../auth";
import { parse } from "../http";
import { authenticate, changeOwnPassword } from "../domain/users";

export const authRouter = Router();

// Slows password guessing from one address; the per-account lockout in authenticate() covers guessing across addresses.
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: config.loginRateLimit, standardHeaders: true, legacyHeaders: false, message: { error: "Too many attempts. Please wait a few minutes." } });

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = parse(z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(500) }), req.body);
  const user = await authenticate(req, email, password);
  // A fresh token on every sign-in: an old one can never be "fixed" onto a new login.
  await destroySession(readCookie(req, SESSION_COOKIE));
  setSessionCookie(res, await createSession(user.id, req));
  res.json({ user });
});

authRouter.post("/logout", async (req, res) => {
  const token = readCookie(req, SESSION_COOKIE);
  await destroySession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireSession, (req, res) => {
  res.json({ user: currentUser(req) });
});

authRouter.post("/change-password", requireSession, async (req, res) => {
  const user = currentUser(req);
  const { current, next } = parse(z.object({ current: z.string().min(1).max(500), next: z.string().min(1).max(500) }), req.body);
  await changeOwnPassword(req, user, current, next, readCookie(req, SESSION_COOKIE));
  res.json({ ok: true });
});
