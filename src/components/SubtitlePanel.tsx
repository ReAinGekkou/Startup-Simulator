import React from 'react';
import { Volume2, Square, X } from 'lucide-react';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useVoiceOver } from '@/src/hooks/useVoiceOver';

interface SubtitlePanelProps {
  hasBottomBar?: boolean;
}

export const SubtitlePanel: React.FC<SubtitlePanelProps> = ({ hasBottomBar = true }) => {
  const { t } = useLocalization();
  const { subtitle, stop, dismissSubtitle } = useVoiceOver();

  if (!subtitle) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('voice.subtitleBarLabel')}
      className={`pointer-events-none fixed left-1/2 -translate-x-1/2 z-40 w-[min(440px,calc(100%-24px))] ${
        hasBottomBar ? 'bottom-[5.5rem] md:bottom-[4.75rem]' : 'bottom-4'
      }`}
    >
      <div className="pointer-events-auto border-2 border-[#303B38] bg-[#FAF8F2]/96 px-3.5 py-2 text-[#303B38] shadow-sm flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Volume2 size={14} className="text-[#303B38]" />
            <span className="text-[13px] font-bold text-[#303B38]">{subtitle.speaker}</span>
            {subtitle.isSpeaking && (
              <span className="bg-[#78978A] border border-[#303B38]/25 px-2 py-0.5 text-[12px] font-bold text-[#303B38]">
                {t('voice.speakingNow')}
              </span>
            )}
            {subtitle.audioSkippedReason === 'NO_VIETNAMESE_VOICE' && (
              <span className="bg-[#EAE5D8] border border-[#303B38]/20 px-2 py-0.5 text-[12px] text-[#303B38]">
                {t('voice.noViVoiceBadge')}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-[#303B38] leading-snug">{subtitle.text}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {subtitle.isSpeaking && (
            <button
              type="button"
              onClick={stop}
              title={t('voice.stopVoiceBtn')}
              aria-label={t('voice.stopVoiceBtn')}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center border border-[#303B38]/25 bg-[#F3F0E7] hover:bg-[#EAE5D8] text-[#303B38] transition-colors cursor-pointer"
            >
              <Square size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={dismissSubtitle}
            title={t('voice.subtitleHide')}
            aria-label={t('voice.subtitleHide')}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center border border-[#303B38]/25 bg-[#F3F0E7] hover:bg-[#EAE5D8] text-[#303B38] transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
