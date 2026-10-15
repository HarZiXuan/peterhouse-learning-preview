// Option A (Gemini / OpenAI) and Option B (a model on the school computer via
// an Ollama-compatible endpoint). These functions only ever receive the
// anonymous payload text built by buildAnonymousPayload().

import fs from "node:fs";
import path from "node:path";
import type { AiSettings } from "../school";
import type { WrittenDraft } from "./types";

/** The writing guide lives in skills/report-writing/SKILL.md so it can be edited without touching code. */
const SKILL_FILE = path.join(process.cwd(), "skills", "report-writing", "SKILL.md");
const FALLBACK_PROMPT = `You write warm end-of-term learning reviews for families at an early years setting. Use British spelling. Refer to the child only as [Child]. Never invent details. Never use numbers, scores or comparisons. Use short sentences, and wrap the 3-5 key words of each paragraph in **double asterisks**. Each paragraph 70-100 words.`;

export function getSystemPrompt(): string {
  try {
    const raw = fs.readFileSync(SKILL_FILE, "utf8");
    const body = raw.replace(/^---[\s\S]*?---\s*/, "").trim();
    return body || FALLBACK_PROMPT;
  } catch {
    return FALLBACK_PROMPT;
  }
}

export function draftInstruction(areaKeys: { key: string; name: string }[]) {
  const shape = `{"opening": "...", "areas": {${areaKeys.map((a) => `"${a.key}": "..."`).join(", ")}}, "closing": "...", "home_ideas": ["...", "..."]}`;
  return `Write the review from these anonymous answers. Reply with JSON only, exactly in this shape:\n${shape}\nArea keys: ${areaKeys
    .map((a) => `${a.key} = ${a.name}`)
    .join("; ")}.`;
}

export function paragraphInstruction(section: string, current: string, tone?: string) {
  const toneLine = tone ? ` Make it ${tone.toLowerCase()} than the current version.` : "";
  return `Rewrite only the ${section} paragraph from these anonymous answers.${toneLine} Current version:\n"""${current}"""\nReply with JSON only: {"text": "..."}`;
}

export class WriterError extends Error {}

async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs = 60_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new WriterError(`The writing service replied ${res.status}.`);
    return (await res.json()) as unknown;
  } catch (e) {
    if (e instanceof WriterError) throw e;
    throw new WriterError("The writing service could not be reached.");
  } finally {
    clearTimeout(t);
  }
}

/** Sends system + user text and returns the model's raw text reply. */
export async function complete(ai: AiSettings, system: string, user: string): Promise<string> {
  if (ai.provider === "gemini") {
    if (!ai.geminiKey) throw new WriterError("No Gemini key is set.");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.geminiModel)}:generateContent`;
    const json = (await postJson(
      url,
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
      },
      { "x-goog-api-key": ai.geminiKey },
    )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new WriterError("The writing service sent an empty reply.");
    return text;
  }
  if (ai.provider === "openai") {
    if (!ai.openaiKey) throw new WriterError("No OpenAI key is set.");
    const json = (await postJson(
      "https://api.openai.com/v1/chat/completions",
      {
        model: ai.openaiModel,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      { authorization: `Bearer ${ai.openaiKey}` },
    )) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new WriterError("The writing service sent an empty reply.");
    return text;
  }
  if (ai.provider === "local") {
    const json = (await postJson(
      `${ai.localUrl.replace(/\/$/, "")}/api/chat`,
      {
        model: ai.localModel,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      {},
      180_000,
    )) as { message?: { content?: string } };
    const text = json.message?.content;
    if (!text) throw new WriterError("The local model sent an empty reply.");
    return text;
  }
  throw new WriterError("No AI service is selected.");
}

function parseJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new WriterError("The reply was not in the expected format.");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new WriterError("The reply was not in the expected format.");
  }
}

export function parseDraft(text: string, areaKeys: string[]): WrittenDraft {
  const j = parseJson(text) as { opening?: unknown; areas?: Record<string, unknown>; closing?: unknown; home_ideas?: unknown };
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const opening = str(j.opening);
  const closing = str(j.closing);
  const areas: Record<string, string> = {};
  for (const k of areaKeys) {
    const v = str(j.areas?.[k]);
    if (!v) throw new WriterError(`The reply was missing a paragraph (${k}).`);
    areas[k] = v;
  }
  if (!opening || !closing) throw new WriterError("The reply was missing the opening or closing.");
  const homeIdeas = Array.isArray(j.home_ideas) ? j.home_ideas.map(str).filter((x): x is string => !!x).slice(0, 2) : [];
  return { opening, areas, closing, homeIdeas };
}

export function parseParagraph(text: string): string {
  const j = parseJson(text) as { text?: unknown };
  if (typeof j.text !== "string" || !j.text.trim()) throw new WriterError("The reply was empty.");
  return j.text.trim();
}

/** Tries once more on a missing or broken response, as section 06 requires. */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof WriterError)) throw e;
    return await fn();
  }
}
