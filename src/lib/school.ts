import { getSetting, setSetting } from "./db";
import { DEFAULT_RUBRIC } from "./rubric-default";
import type { Rubric } from "./types";

export type SchoolDetails = {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Teacher name(s) printed on every report, comma-separated. */
  teachers: string;
  /** Class name printed on every report. */
  className: string;
};

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
  backupDir: string;
  backupKeepDays: number;
  autoBackup: boolean;
  showProgressOnReports: boolean;
  homeIdeasOnReports: boolean;
  /** Show the score out of 10 for each learning area. */
  showScoresOnReports: boolean;
};

export const DEFAULT_RECORDS: RecordsSettings = {
  retentionYears: 3,
  backupDir: "",
  backupKeepDays: 30,
  autoBackup: true,
  showProgressOnReports: false,
  homeIdeasOnReports: true,
  showScoresOnReports: true,
};

export const getSchool = (): SchoolDetails => ({ ...DEFAULT_SCHOOL, ...getSetting<Partial<SchoolDetails>>("school", {}) });
export const setSchool = (s: SchoolDetails) => setSetting("school", s);

/**
 * The writing service is configured only through the environment (.env.local / the server's env file):
 * GEMINI_API_KEY or OPENAI_API_KEY, and optionally AI_PROVIDER (gemini | openai | local | sentence_bank).
 * With no key the built-in basic writer is used.
 */
export function getAi(): AiSettings {
  const geminiKey = process.env.GEMINI_API_KEY ?? "";
  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  const wanted = process.env.AI_PROVIDER as AiProvider | undefined;
  const provider: AiProvider =
    wanted && ["gemini", "openai", "local", "sentence_bank"].includes(wanted) ? wanted : geminiKey ? "gemini" : openaiKey ? "openai" : "sentence_bank";
  return {
    ...DEFAULT_AI,
    provider,
    geminiKey,
    openaiKey,
    geminiModel: process.env.GEMINI_MODEL || DEFAULT_AI.geminiModel,
    openaiModel: process.env.OPENAI_MODEL || DEFAULT_AI.openaiModel,
    localUrl: process.env.LOCAL_AI_URL || DEFAULT_AI.localUrl,
    localModel: process.env.LOCAL_AI_MODEL || DEFAULT_AI.localModel,
  };
}

export const getRecords = (): RecordsSettings => ({ ...DEFAULT_RECORDS, ...getSetting<Partial<RecordsSettings>>("records", {}) });
export const setRecords = (s: RecordsSettings) => setSetting("records", s);

/** The live rubric. Reviews keep their own frozen copy (see reviews.ts). */
export const getRubric = (): Rubric => getSetting<Rubric>("rubric", DEFAULT_RUBRIC);
export const setRubric = (r: Rubric) => setSetting("rubric", r);
