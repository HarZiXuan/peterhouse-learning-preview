import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";
import { SESSION_COOKIE } from "./session";

// PDFs are produced by printing the report page in a built-in browser, so the
// report uses the real Peterhouse fonts and colours.

function findChrome(): string {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((x): x is string => !!x);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  // Fall back to a Chrome downloaded by Puppeteer's installer.
  const cache = path.join(os.homedir(), ".cache", "puppeteer");
  for (const kind of ["chrome-headless-shell", "chrome"]) {
    const dir = path.join(cache, kind);
    if (!fs.existsSync(dir)) continue;
    for (const v of fs.readdirSync(dir).sort().reverse()) {
      const base = path.join(dir, v);
      const sub = fs.readdirSync(base).find((x) => x.startsWith(kind));
      if (!sub) continue;
      const exe =
        kind === "chrome"
          ? path.join(base, sub, "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing")
          : path.join(base, sub, "chrome-headless-shell");
      if (fs.existsSync(exe)) return exe;
    }
  }
  throw new Error("No Chrome or Edge browser was found to print PDFs. Install Google Chrome or set CHROME_PATH.");
}

type G = typeof globalThis & { __lrBrowser?: Promise<Browser> };
const g = globalThis as G;

async function browser(): Promise<Browser> {
  if (g.__lrBrowser) {
    const b = await g.__lrBrowser.catch(() => null);
    if (b?.connected) return b;
  }
  g.__lrBrowser = puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ["--no-first-run", "--no-default-browser-check", "--disable-extensions"],
  });
  return g.__lrBrowser;
}

/** Prints /report/:id to an A4 PDF. `origin` is this server's own address. */
export function renderReportPdf(origin: string, reviewId: number, sessionToken?: string) {
  return printPage(`${origin}/report/${reviewId}`, origin, sessionToken);
}

async function printPage(url: string, origin: string, sessionToken?: string): Promise<Buffer> {
  const b = await browser();
  const page = await b.newPage();
  try {
    // The report page is behind the login, so the printing browser carries the same session.
    if (sessionToken) await page.setCookie({ name: SESSION_COOKIE, value: sessionToken, url: origin });
    const res = await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    if (!res || !res.ok()) throw new Error(`The report page could not be opened (${res?.status()}).`);
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}
