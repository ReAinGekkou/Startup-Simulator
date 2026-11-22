import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Volume2 } from 'lucide-react';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useVoiceOver } from '@/src/hooks/useVoiceOver';
import { getPersonalityLocalized } from '@/src/localization/i18n';
import { ChatterMessage } from '@/src/types/game';

interface EmployeeChatterFeedProps {
  messages: ChatterMessage[];
  onSelectEmployee: (employeeId: string) => void;
  hideOnMobile?: boolean;
}

export const EmployeeChatterFeed: React.FC<EmployeeChatterFeedProps> = ({
  messages,
  onSelectEmployee,
  hideOnMobile = false,
}) => {
  const { locale, t, formatHour } = useLocalization();
  const { speak } = useVoiceOver();
  const [collapsed, setCollapsed] = useState(false);

  if (messages.length === 0) return null;

  const visible = messages.slice(0, 2);

  return (
    <section
      aria-label={t('chatter.title')}
      className={`fixed left-3 md:left-48 lg:left-52 bottom-32 md:bottom-20 z-10 w-68 sm:w-76 pointer-events-none flex-col gap-1.5 ${
        hideOnMobile ? 'hidden md:flex' : 'flex'
      }`}
    >
      <div className="pointer-events-auto flex items-center justify-between bg-[#FAF8F2]/95 border border-[#303B38]/30 px-3 py-1.5 min-h-[38px]">
        <div className="flex items-center gap-2 text-[13px] font-bold text-[#303B38]">
          <MessageSquare className="w-4 h-4 text-[#303B38]" aria-hidden="true" />
          <span>{t('chatter.title')}</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="min-w-[34px] min-h-[34px] flex items-center justify-center text-[#303B38] hover:bg-[#EAE5D8] cursor-pointer"
          title={collapsed ? t('chatter.expand') : t('chatter.minimize')}
          aria-label={collapsed ? t('chatter.expand') : t('chatter.minimize')}
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-1.5">
          {visible.map((msg, idx) => {
            const opacityClass = idx === 0 ? 'opacity-100' : 'opacity-90';
            const personalityLabel = getPersonalityLocalized(msg.personality, locale).label;
            const toneTag =
              msg.tone === 'STRESSED'
                ? ` [${t('chatter.stressedTag')}]`
                : msg.tone === 'EVENT'
                  ? ` [${t('chatter.eventTag')}]`
                  : '';

            return (
              <div
                key={msg.id}
                className={`pointer-events-auto bg-[#F3F0E7]/95 hover:bg-[#FAF8F2] border border-[#303B38]/30 ${opacityClass} px-3 py-2 transition-colors flex items-start gap-2`}
              >
                <button
                  type="button"
                  onClick={() => onSelectEmployee(msg.employeeId)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-bold text-[#303B38] truncate">
                        {msg.employeeName}
                      </span>
                      <span className="text-[#303B38]/75 truncate">
                        · {msg.roleLabel} · {personalityLabel}
                        {toneTag}
                      </span>
                    </div>
                    <span className="font-mono-num text-[13px] text-[#303B38]/75 shrink-0">
                      {formatHour(msg.hour)}
                    </span>
                  </div>
                  <p className="text-[14px] text-[#303B38] leading-snug mt-1 line-clamp-2">
                    "{msg.text}"
                  </p>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speak({
                      speaker: `${msg.employeeName} (${msg.roleLabel})`,
                      text: msg.text,
                      locale,
                      category: 'DIALOGUE',
                      userInitiated: true,
                    });
                  }}
                  title={t('chatter.listenTooltip')}
                  aria-label={t('chatter.listenTooltip')}
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/25 text-[#303B38] cursor-pointer shrink-0 mt-0.5"
                >
                  <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
