import React from 'react';
import { CheckCircle2, Square, Volume2 } from 'lucide-react';
import { getDailyReportVoiceScript } from '@/src/audio/voiceRegistry';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useVoiceOver } from '@/src/hooks/useVoiceOver';
import { DailySummaryReport } from '@/src/types/game';
import { ModalFrame } from './ModalFrame';

interface DailyReportModalProps {
  report: DailySummaryReport;
  onContinue: () => void;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({ report, onContinue }) => {
  const { locale, t, formatCurrency } = useLocalization();
  const { speak, stop, isSpeaking } = useVoiceOver();

  const handleToggleRead = () => {
    if (isSpeaking) {
      stop();
      return;
    }
    const script = getDailyReportVoiceScript(report, locale);
    speak({
      speaker: script.speaker,
      text: script.text,
      locale,
      category: 'REPORT',
      userInitiated: true,
    });
  };

  return (
    <ModalFrame
      title={t('reports.dailyTitle', { day: report.day })}
      subtitle={t('reports.dailySubtitle', { month: report.month, year: report.year })}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4">
            <div className="text-[13px] text-[#303B38]/80">{t('hud.cashBalance')}</div>
            <div className="text-[22px] sm:text-[24px] font-bold font-mono-num text-[#303B38] mt-1">
              {formatCurrency(report.cashBalance)}
            </div>
          </div>
          <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4">
            <div className="text-[13px] text-[#303B38]/80">{t('reports.dayRevenue')}</div>
            <div className="text-[22px] sm:text-[24px] font-bold font-mono-num text-[#303B38] mt-1">
              +{formatCurrency(report.revenueEarned)}
            </div>
          </div>
        </div>

        <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 space-y-2 text-[15px]">
          <div className="flex justify-between">
            <span className="text-[#303B38]/85">{t('reports.totalPaying')}</span>
            <span className="font-bold font-mono-num">{report.customersTotal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#303B38]/85">{t('reports.avgMorale')}</span>
            <span className="font-bold font-mono-num">{report.avgMorale}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#303B38]/85">{t('reports.operatingSpend')}</span>
            <span className="font-bold font-mono-num">{formatCurrency(report.expensesSpent)}</span>
          </div>
        </div>

        <div className="bg-[#EAE5D8] border border-[#303B38]/20 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[14px] font-bold text-[#303B38]">
              {t('reports.dailyHighlights')}
            </div>
            <button
              type="button"
              onClick={handleToggleRead}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF8F2] hover:bg-[#F3F0E7] border border-[#303B38]/30 text-[13px] font-bold text-[#303B38] cursor-pointer"
            >
              {isSpeaking ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>{t('common.stopAudio')}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                  <span>{t('reports.listenReport')}</span>
                </>
              )}
            </button>
          </div>
          <ul className="space-y-1.5 text-[15px] text-[#303B38]">
            {report.highlights.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#303B38] shrink-0 mt-1" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="w-full min-h-[46px] py-2.5 px-4 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/35 text-[#303B38] font-bold text-[15px] cursor-pointer"
        >
          {t('reports.startNextDay', { day: report.day + 1 })}
        </button>
      </div>
    </ModalFrame>
  );
};
