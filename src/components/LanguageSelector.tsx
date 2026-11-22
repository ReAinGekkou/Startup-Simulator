import React from 'react';
import { Globe } from 'lucide-react';
import { useLocalization } from '@/src/hooks/useLocalization';
import { LocaleCode } from '@/src/localization/localeStore';

interface LanguageSelectorProps {
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ compact = false }) => {
  const { locale, setLocale, t } = useLocalization();

  const options: Array<{ code: LocaleCode; label: string }> = [
    { code: 'vi-VN', label: t('language.vi-VN') },
    { code: 'en-US', label: t('language.en-US') },
  ];

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 rounded-lg border border-[#303B38]/20 bg-[#F3F0E7] p-1">
        <Globe size={15} className="ml-1.5 text-[#303B38]/75" />
        {options.map((opt) => {
          const active = locale === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => setLocale(opt.code)}
              className={`px-2.5 py-1 rounded-md text-[14px] font-bold transition-colors ${
                active
                  ? 'bg-[#78978A] border-[#303B38]/40 text-[#303B38]'
                  : 'text-[#303B38]/80 hover:bg-[#303B38]/10'
              }`}
            >
              {opt.code === 'vi-VN' ? 'Tiếng Việt' : 'English'}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#303B38]/20 bg-[#FAF8F2] p-4 space-y-2.5">
      <div className="flex items-center gap-2 text-[#303B38]">
        <Globe size={17} />
        <span className="text-[16px] font-bold">{t('language.label')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = locale === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => setLocale(opt.code)}
              className={`px-3 py-2.5 rounded-lg border text-[15px] font-bold transition-colors ${
                active
                  ? 'bg-[#78978A] border-[#303B38]/35 text-[#303B38]'
                  : 'bg-[#F3F0E7] border-[#303B38]/20 text-[#303B38] hover:border-[#303B38]/45'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-[#303B38]/75 leading-snug">{t('language.hint')}</p>
    </div>
  );
};
