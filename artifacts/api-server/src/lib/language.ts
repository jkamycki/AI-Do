import type { Request } from "express";

const LANGUAGE_CODE_TO_NAME: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
  nl: "Dutch",
  pl: "Polish",
};

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function languageNameFromCode(code?: string | null): string | null {
  const normalized = code?.trim().toLowerCase().split("-", 1)[0];
  if (!normalized) return null;
  return LANGUAGE_CODE_TO_NAME[normalized] ?? null;
}

export function getRequestLanguage(req: Request, fallback?: string | null): string {
  const headerLanguage = languageNameFromCode(firstHeaderValue(req.headers["x-aido-language-code"]));
  if (headerLanguage) return headerLanguage;

  const bodyLanguage = typeof req.body?.preferredLanguage === "string"
    ? req.body.preferredLanguage.trim()
    : "";
  if (bodyLanguage) return bodyLanguage;

  return fallback || "English";
}

export function aiLanguageInstruction(language?: string | null, detail = "Write the entire response"): string {
  if (!language || language === "English") return "";
  return `${detail} in ${language}.`;
}

