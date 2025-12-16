import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhTranslations from "@/locales/zh.json";
import enTranslations from "@/locales/en.json";

i18n.use(initReactI18next).init({
  resources: {
    zh: {
      translation: zhTranslations,
    },
    en: {
      translation: enTranslations,
    },
  },
  lng:
    typeof window !== "undefined"
      ? localStorage.getItem("language") || "zh"
      : "zh",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
