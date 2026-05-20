import i18n, { LANG_CODE_TO_NAME } from "@/i18n";

const LANGUAGE_HEADER = "x-aido-language-code";

export function getCurrentLanguageCode(): string {
  const active = i18n.resolvedLanguage || i18n.language || "en";
  return active.split("-")[0] || "en";
}

export function getCurrentLanguageName(): string {
  return LANG_CODE_TO_NAME[getCurrentLanguageCode()] ?? "English";
}

export function getLanguageHeader(): Record<string, string> {
  return { [LANGUAGE_HEADER]: getCurrentLanguageCode() };
}

