import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import arTranslations from './locales/ar.json';
import enTranslations from './locales/en.json';
import languagesList from './locales/languages.json';

export interface Language {
  code: string;
  name: string;
  dir: 'rtl' | 'ltr';
}

export const LANGUAGES: Language[] = languagesList as Language[];

const savedLang = localStorage.getItem('pk_app_lang') || 'ar';

// Define localized dictionaries for other global languages to make design authentic
const extraResources: Record<string, Record<string, string>> = {
  es: {
    "app_name": "Rey de la Privacidad",
    "home": "Inicio",
    "pricing": "Precios",
    "upgrade_pro": "Actualizar a Pro",
    "secured_local_mode": "Modo Local Seguro",
    "process_and_download": "Procesar y Descargar",
    "back_to_home": "Volver al Inicio"
  },
  fr: {
    "app_name": "Roi de la Confidentialité",
    "home": "Accueil",
    "pricing": "Tarifs",
    "upgrade_pro": "Passer à Pro",
    "secured_local_mode": "Mode Local Sécurisé",
    "process_and_download": "Traiter et Télécharger",
    "back_to_home": "Retour à l'Accueil"
  },
  de: {
    "app_name": "Datenschutz König",
    "home": "Startseite",
    "pricing": "Preise",
    "upgrade_pro": "Auf Pro upgraden",
    "secured_local_mode": "Sicherer Lokaler Modus",
    "process_and_download": "Verarbeiten und Herunterladen",
    "back_to_home": "Zurück zur Startseite"
  },
  tr: {
    "app_name": "Gizlilik Kralı",
    "home": "Ana Sayfa",
    "pricing": "Fiyatlandırma",
    "upgrade_pro": "Pro'ya Yükselt",
    "secured_local_mode": "Güvenli Yerel Mod",
    "process_and_download": "İşle ve İndir",
    "back_to_home": "Ana Sayfaya Dön"
  },
  it: {
    "app_name": "Re della Privacy",
    "home": "Home",
    "pricing": "Prezzi",
    "upgrade_pro": "Aggiorna a Pro",
    "secured_local_mode": "Modalità Locale Sicura",
    "process_and_download": "Elabora e Scarica"
  },
  pt: {
    "app_name": "Rei da Privacidade",
    "home": "Início",
    "pricing": "Preços",
    "upgrade_pro": "Atualizar para Pro",
    "secured_local_mode": "Modo Local Seguro",
    "process_and_download": "Processar e Baixar"
  },
  ru: {
    "app_name": "Король Конфиденциальности",
    "home": "Главная",
    "pricing": "Цены",
    "upgrade_pro": "Обновить до Pro",
    "secured_local_mode": "Безопасный Локальный Режим",
    "process_and_download": "Обработать и Скачать"
  },
  zh: {
    "app_name": "隐私之王 (Privacy King)",
    "home": "首页",
    "pricing": "价格",
    "upgrade_pro": "升级到 Pro",
    "secured_local_mode": "安全的本地模式",
    "process_and_download": "处理并下载"
  },
  ja: {
    "app_name": "プライバシーキング",
    "home": "ホーム",
    "pricing": "料金プラン",
    "upgrade_pro": "Proにアップグレード",
    "secured_local_mode": "安全なローカルモード",
    "process_and_download": "処理してダウンロード"
  },
  ko: {
    "app_name": "프라이버시 킹",
    "home": "홈",
    "pricing": "요금제",
    "upgrade_pro": "Pro로 업그레이드",
    "secured_local_mode": "보안 로컬 모드",
    "process_and_download": "처리 및 다운로드"
  }
};

const resources: Record<string, { translation: Record<string, any> }> = {
  ar: { translation: arTranslations },
  en: { translation: enTranslations }
};

// Seed fallback values statically
Object.entries(extraResources).forEach(([lng, trans]) => {
  resources[lng] = {
    translation: {
      ...enTranslations, // Default to English values for untranslated keys
      ...trans
    }
  };
});

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes XSS
    }
  });

export const getLanguageInfo = (langCode: string): Language => {
  return LANGUAGES.find(l => l.code === langCode) || LANGUAGES[0];
};

export const applyLanguageSettings = (langCode: string) => {
  const info = getLanguageInfo(langCode);
  document.documentElement.setAttribute('dir', info.dir);
  document.documentElement.setAttribute('lang', info.code);
  localStorage.setItem('pk_app_lang', langCode);
};

// Apply default on startup immediately (synchronous, prevents Layout Shift)
applyLanguageSettings(savedLang);

export default i18n;
