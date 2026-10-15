// A single shared school login, kept in environment variables (APP_LOGIN_USER / APP_LOGIN_PASSWORD).
// The session is a signed, expiring cookie. This file uses only Web Crypto so the middleware can import it.

export const SESSION_COOKIE = "ph_session";
export const SESSION_DAYS = 7;

const enc = new TextEncoder();

export function loginConfigured(): boolean {
  return !!(process.env.APP_LOGIN_USER && process.env.APP_LOGIN_PASSWORD);
}

/** In production a login is always required; in development it is only required if configured. */
export function authRequired(): boolean {
  return process.env.NODE_ENV === "production" || loginConfigured();
}

function secret(): string {
  return process.env.SESSION_SECRET || `${process.env.APP_LOGIN_USER ?? ""}\n${process.env.APP_LOGIN_PASSWORD ?? ""}`;
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSessionToken(): Promise<string> {
  const exp = String(Date.now() + SESSION_DAYS * 86_400_000);
  return `${exp}.${await hmac(exp)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !loginConfigured()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = await hmac(exp);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
