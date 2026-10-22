import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";
import { config } from "../config";
import { SESSION_COOKIE } from "../auth";

// PDFs are produced by printing the report page in a headless browser, so the report uses the real
// Peterhouse fonts and colours. The browser opens the frontend's /report/:id page on the internal network,
// signed in with a two-minute session that exists only for this one print.

function findChrome(): string {
  const candidates = [
    config.chromePath,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((x): x is string => !!x);
  for (const c of candidates) if (fs.existsSync(c)) return c;
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
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-dev-shm-usage",
      // In a container Chrome's own sandbox cannot start; the container is the sandbox, and Chrome only ever opens our report page.
      ...(config.chromeNoSandbox ? ["--no-sandbox"] : []),
    ],
  });
  return g.__lrBrowser;
}

export async function closeBrowser() {
  const b = await g.__lrBrowser?.catch(() => null);
  g.__lrBrowser = undefined;
  await b?.close().catch(() => {});
}

/** Prints the frontend's /report/:id page to an A4 PDF using the given (short-lived) session token. */
export async function renderReportPdf(reviewId: number, sessionToken: string): Promise<Buffer> {
  const origin = config.frontendInternalUrl;
  const b = await browser();
  const page = await b.newPage();
  try {
    await page.setCookie({ name: SESSION_COOKIE, value: sessionToken, url: origin });
    const res = await page.goto(`${origin}/report/${reviewId}`, { waitUntil: "networkidle0", timeout: 60_000 });
    if (!res || !res.ok()) throw new Error(`The report page could not be opened (${res?.status()}).`);
    await page.evaluate(() => document.fonts.ready);
    // Each teachers' note sizes its words to fill its box once the fonts are in.
    await page.waitForFunction(() => !document.querySelector('[data-fit="pending"]'), { timeout: 5_000 }).catch(() => {});
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}
