import { getLocale, LocaleCode } from '@/src/localization/localeStore';

export function formatCurrency(
  amount: number,
  compact = false,
  locale: LocaleCode = getLocale()
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);

  if (locale === 'vi-VN') {
    if (compact) {
      if (abs >= 1_000_000) {
        return `${sign}${(abs / 1_000_000).toFixed(2).replace('.', ',')} Tr ₫`;
      }
      if (abs >= 10_000) {
        return `${sign}${(abs / 1_000).toFixed(1).replace('.', ',')} N ₫`;
      }
    }
    return `${sign}${Math.round(abs).toLocaleString('vi-VN')} ₫`;
  }

  if (compact) {
    if (abs >= 1_000_000) {
      return `${sign}${(abs / 1_000_000).toFixed(2)}M VND`;
    }
    if (abs >= 10_000) {
      return `${sign}${(abs / 1_000).toFixed(1)}k VND`;
    }
  }
  return `${sign}${Math.round(abs).toLocaleString('en-US')} VND`;
}

export function formatNumber(amount: number, locale: LocaleCode = getLocale()): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return Math.round(safe).toLocaleString(locale === 'vi-VN' ? 'vi-VN' : 'en-US');
}

export function formatHour(hour: number, locale: LocaleCode = getLocale()): string {
  const whole = Math.floor(hour);
  const mins = Math.floor((hour - whole) * 60);
  if (locale === 'vi-VN') {
    return `${whole.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  const period = whole >= 12 ? 'PM' : 'AM';
  const h12 = whole % 12 === 0 ? 12 : whole % 12;
  return `${h12}:${mins.toString().padStart(2, '0')} ${period}`;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
