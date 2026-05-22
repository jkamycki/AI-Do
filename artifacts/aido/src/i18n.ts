import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

export const LANG_NAME_TO_CODE: Record<string, string> = {
  "English": "en",
  "Spanish": "es",
  "French": "fr",
  "German": "de",
  "Italian": "it",
  "Portuguese": "pt",
  "Chinese (Simplified)": "zh",
  "Japanese": "ja",
  "Korean": "ko",
  "Arabic": "ar",
  "Hindi": "hi",
  "Russian": "ru",
  "Dutch": "nl",
  "Polish": "pl",
};

export const LANG_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(LANG_NAME_TO_CODE).map(([name, code]) => [code, name])
);

const savedLang = localStorage.getItem("aido_language") ?? "en";

const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);
const LOCALE_LOADERS: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  es: () => import("./locales/es.json"),
  fr: () => import("./locales/fr.json"),
  de: () => import("./locales/de.json"),
  it: () => import("./locales/it.json"),
  pt: () => import("./locales/pt.json"),
  zh: () => import("./locales/zh.json"),
  ja: () => import("./locales/ja.json"),
  ko: () => import("./locales/ko.json"),
  ar: () => import("./locales/ar.json"),
  hi: () => import("./locales/hi.json"),
  ru: () => import("./locales/ru.json"),
  nl: () => import("./locales/nl.json"),
  pl: () => import("./locales/pl.json"),
};

function applyDocumentDirection(lng: string) {
  if (typeof document === "undefined") return;
  const dir = RTL_LANGS.has(lng) ? "rtl" : "ltr";
  document.documentElement.setAttribute("lang", lng);
  document.documentElement.setAttribute("dir", dir);
}

async function loadLocale(lng: string) {
  if (lng === "en" || i18n.hasResourceBundle(lng, "translation")) return;
  const loader = LOCALE_LOADERS[lng];
  if (!loader) return;
  const mod = await loader();
  i18n.addResourceBundle(lng, "translation", mod.default, true, true);
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lng?: string, callback?: Parameters<typeof originalChangeLanguage>[1]) => {
  if (lng) await loadLocale(lng);
  return originalChangeLanguage(lng, callback);
};

if (savedLang !== "en") {
  void i18n.changeLanguage(savedLang);
}

applyDocumentDirection(i18n.language || savedLang);
i18n.on("languageChanged", (lng) => applyDocumentDirection(lng));

export default i18n;
