import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getLocale,
  LocaleCode,
  setLocale as updateLocale,
  subscribeLocale,
  t as translate,
} from '@/src/localization';
import { formatCurrency as fmtCurrency, formatHour as fmtHour, formatNumber as fmtNumber } from '@/src/utils/format';

interface LocalizationContextValue {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatCurrency: (amount: number, compact?: boolean) => string;
  formatNumber: (amount: number) => string;
  formatHour: (hour: number) => string;
}

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<LocaleCode>(() => getLocale());

  useEffect(() => {
    const unsub = subscribeLocale((next) => setLocaleState(next));
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'vi-VN' ? 'vi' : 'en';
      document.title = translate('app.title', undefined, locale);
    }
    return unsub;
  }, [locale]);

  const setLocale = useCallback((next: LocaleCode) => {
    updateLocale(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, vars, locale),
    [locale]
  );

  const formatCurrency = useCallback(
    (amount: number, compact = false) => fmtCurrency(amount, compact, locale),
    [locale]
  );

  const formatNumber = useCallback(
    (amount: number) => fmtNumber(amount, locale),
    [locale]
  );

  const formatHour = useCallback(
    (hour: number) => fmtHour(hour, locale),
    [locale]
  );

  return React.createElement(
    LocalizationContext.Provider,
    {
      value: {
        locale,
        setLocale,
        t,
        formatCurrency,
        formatNumber,
        formatHour,
      },
    },
    children
  );
};

export function useLocalization(): LocalizationContextValue {
  const ctx = useContext(LocalizationContext);
  if (ctx) return ctx;
  const fallbackLocale = getLocale();
  return {
    locale: fallbackLocale,
    setLocale: updateLocale,
    t: (key: string, vars?: Record<string, string | number>) =>
      translate(key, vars, fallbackLocale),
    formatCurrency: (amount: number, compact = false) =>
      fmtCurrency(amount, compact, fallbackLocale),
    formatNumber: (amount: number) => fmtNumber(amount, fallbackLocale),
    formatHour: (hour: number) => fmtHour(hour, fallbackLocale),
  };
}
