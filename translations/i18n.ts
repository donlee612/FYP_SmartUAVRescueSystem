import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './en/translations.json';
import zhTranslations from './zh/translations.json';

i18next
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      zh: { translation: zhTranslations },
    },
    lng: 'zh', // 默認語言為中文
    fallbackLng: 'en', // 回退語言為英文
    interpolation: {
      escapeValue: false, // React Native 不需要轉義
    },
  });

export default i18next;