import type { Rubric, SchoolDetails } from "@peterhouse/shared";
import { config } from "../config";
import { publishedRubric } from "./questions";
import { getSetting, setSetting } from "./settings";

export type { SchoolDetails };

export const DEFAULT_SCHOOL: SchoolDetails = {
  name: "Peterhouse Preschool",
  address: "Singapore",
  phone: "+65 8028 9094",
  email: "admin@peterhouse.sg",
  teachers: "",
  className: "",
};

export type AiProvider = "sentence_bank" | "gemini" | "openai" | "local";

export type AiSettings = {
  provider: AiProvider;
  geminiModel: string;
  geminiKey: string;
  openaiModel: string;
  openaiKey: string;
  localUrl: string;
  localModel: string;
};

export const DEFAULT_AI: AiSettings = {
  provider: "sentence_bank",
  geminiModel: "gemini-2.5-flash",
  geminiKey: "",
  openaiModel: "gpt-4.1-mini",
  openaiKey: "",
  localUrl: "http://127.0.0.1:11434",
  localModel: "llama3.1:8b",
};

export type RecordsSettings = {
  retentionYears: number;
  showProgressOnReports: boolean;
  homeIdeasOnReports: boolean;
};

export const DEFAULT_RECORDS: RecordsSettings = {
  retentionYears: 3,
  showProgressOnReports: false,
  homeIdeasOnReports: true,
};

export const getSchool = async (): Promise<SchoolDetails> => ({ ...DEFAULT_SCHOOL, ...(await getSetting<Partial<SchoolDetails>>("school", {})) });
export const setSchool = (s: SchoolDetails) => setSetting("school", s);

/**
 * The writing service is configured only through the server's environment (GEMINI_API_KEY or OPENAI_API_KEY,
 * and optionally AI_PROVIDER). Keys are never stored in the database. With no key the built-in writer is used.
 */
export function getAi(): AiSettings {
  const c = config.ai;
  const wanted = c.provider as AiProvider | undefined;
  const provider: AiProvider =
    wanted && ["gemini", "openai", "local", "sentence_bank"].includes(wanted) ? wanted : c.geminiKey ? "gemini" : c.openaiKey ? "openai" : "sentence_bank";
  return {
    ...DEFAULT_AI,
    provider,
    geminiKey: c.geminiKey,
    openaiKey: c.openaiKey,
    geminiModel: c.geminiModel || DEFAULT_AI.geminiModel,
    openaiModel: c.openaiModel || DEFAULT_AI.openaiModel,
    localUrl: c.localUrl || DEFAULT_AI.localUrl,
    localModel: c.localModel || DEFAULT_AI.localModel,
  };
}

export const hasAi = (): boolean => {
  const ai = getAi();
  return ai.provider === "gemini" ? !!ai.geminiKey : ai.provider === "openai" ? !!ai.openaiKey : ai.provider === "local";
};

export const getRecords = async (): Promise<RecordsSettings> => ({ ...DEFAULT_RECORDS, ...(await getSetting<Partial<RecordsSettings>>("records", {})) });
export const setRecords = (s: RecordsSettings) => setSetting("records", s);

/** The latest published question set. Reviews keep their own frozen copy (see reviews.ts). */
export const getRubric = async (): Promise<Rubric> => (await publishedRubric()).rubric;
