import i18next from "i18next";
import HttpApi from "i18next-http-backend";

let translations = {};

/**
 * Initializes i18next with the HTTP backend to load JSON files.
 */
export async function initI18n(lang = "en") {
  await i18next.use(HttpApi).init({
    lng: lang,
    fallbackLng: "en",
    debug: false,
    backend: {
      loadPath: "./locales/{{lng}}.json",
    },
  });
  translations = i18next.getResourceBundle(lang, "translation") || {
    loaded: true,
  };
}

/**
 * Proxy function to i18next.t
 */
export function t(key, vars = {}) {
  if (!translations || Object.keys(translations).length === 0) return key;
  return i18next.t(key, vars);
}

export default i18next;
