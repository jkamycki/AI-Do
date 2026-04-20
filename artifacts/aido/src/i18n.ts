import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import it from "./locales/it.json";
import pt from "./locales/pt.json";
import zh from "./locales/zh.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import ar from "./locales/ar.json";
import hi from "./locales/hi.json";
import ru from "./locales/ru.json";
import nl from "./locales/nl.json";
import pl from "./locales/pl.json";

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

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      it: { translation: it },
      pt: { translation: pt },
      zh: { translation: zh },
      ja: { translation: ja },
      ko: { translation: ko },
      ar: { translation: ar },
      hi: { translation: hi },
      ru: { translation: ru },
      nl: { translation: nl },
      pl: { translation: pl },
    },
    lng: savedLang,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

export default i18n;
