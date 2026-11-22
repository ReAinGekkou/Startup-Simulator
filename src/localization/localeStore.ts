export type LocaleCode = 'vi-VN' | 'en-US';

export const DEFAULT_LOCALE: LocaleCode = 'vi-VN';
export const LOCALE_STORAGE_KEY = 'startup_founder_locale_v1';

const listeners = new Set<(locale: LocaleCode) => void>();

function readInitialLocale(): LocaleCode {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === 'vi-VN' || saved === 'en-US') {
        return saved;
      }
    }
  } catch {
    // Ignore storage read failures in restricted contexts
  }
  return DEFAULT_LOCALE;
}

let currentLocale: LocaleCode = readInitialLocale();

export function getLocale(): LocaleCode {
  return currentLocale;
}

export function setLocale(next: LocaleCode): void {
  if (next !== 'vi-VN' && next !== 'en-US') return;
  if (currentLocale === next) return;
  currentLocale = next;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  } catch {
    // Ignore storage write failures
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next === 'vi-VN' ? 'vi' : 'en';
  }
  listeners.forEach((fn) => fn(currentLocale));
}

export function subscribeLocale(listener: (locale: LocaleCode) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
