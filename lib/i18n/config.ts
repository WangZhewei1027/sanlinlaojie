import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhTranslations from "@/locales/zh.json";
import enTranslations from "@/locales/en.json";
import { DEFAULT_LANGUAGE } from "@/lib/i18n/settings";

i18n.use(initReactI18next).init({
  resources: {
    zh: {
      translation: zhTranslations,
    },
    en: {
      translation: enTranslations,
    },
  },
  // 真实语言由 I18nProvider 根据 cookie 在首帧渲染前设置,
  // 这里只提供一个两端一致的初始值
  lng: DEFAULT_LANGUAGE,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
