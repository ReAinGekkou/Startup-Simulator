import React from 'react';
import { Square, Volume2 } from 'lucide-react';
import { getMonthlyReportVoiceScript } from '@/src/audio/voiceRegistry';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useVoiceOver } from '@/src/hooks/useVoiceOver';
import { getLocalizedMonthlySummaryNote } from '@/src/localization/i18n';
import { MonthlyReport } from '@/src/types/game';
import { ModalFrame } from './ModalFrame';

interface MonthlyReportModalProps {
  report: MonthlyReport;
  onContinue: () => void;
}

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({ report, onContinue }) => {
  const { locale, t, formatCurrency } = useLocalization();
  const { speak, stop, isSpeaking } = useVoiceOver();
  const profitable = report.netProfit >= 0;
  const summaryNote = getLocalizedMonthlySummaryNote(report, locale);

  const handleToggleRead = () => {
    if (isSpeaking) {
      stop();
      return;
    }
    const script = getMonthlyReportVoiceScript(report, locale);
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
      title={t('reports.monthlyTitle', { month: report.month, year: report.year })}
      subtitle={t('reports.monthlySubtitle')}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] text-[#303B38]/80">{t('reports.netProfitLoss')}</div>
            <div className="text-[22px] sm:text-[24px] font-mono-num font-bold text-[#303B38] mt-0.5">
              {profitable ? '+' : ''}
              {formatCurrency(report.netProfit)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] text-[#303B38]/80">{t('reports.endingCash')}</div>
            <div className="text-[20px] sm:text-[22px] font-mono-num font-bold text-[#303B38] mt-0.5">
              {formatCurrency(report.endingCash)}
            </div>
          </div>
        </div>

        <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 space-y-2 text-[15px]">
          <div className="flex justify-between font-bold text-[#303B38]">
            <span>{t('reports.totalRevenue')}</span>
            <span className="font-mono-num">{formatCurrency(report.revenue)}</span>
          </div>
          <div className="flex justify-between text-[#303B38]/85 pl-3 text-[14px]">
            <span>{t('reports.productSalesSub')}</span>
            <span className="font-mono-num">{formatCurrency(report.productRevenue)}</span>
          </div>
          <div className="flex justify-between text-[#303B38]/85 pl-3 text-[14px]">
            <span>{t('reports.b2bContracts')}</span>
            <span className="font-mono-num">{formatCurrency(report.contractRevenue)}</span>
          </div>

          <div className="border-t border-[#303B38]/20 my-2" />

          <div className="flex justify-between font-bold text-[#303B38]">
            <span>{t('reports.totalExpenses')}</span>
            <span className="font-mono-num">{formatCurrency(report.expenses)}</span>
          </div>
          <div className="flex justify-between text-[#303B38]/85 pl-3 text-[14px]">
            <span>{t('reports.employeePayroll', { count: report.headcount })}</span>
            <span className="font-mono-num">{formatCurrency(report.salaries)}</span>
          </div>
          <div className="flex justify-between text-[#303B38]/85 pl-3 text-[14px]">
            <span>{t('reports.founderSalaryLine')}</span>
            <span className="font-mono-num">{formatCurrency(report.founderSalary ?? 0)}</span>
          </div>
          <div className="flex justify-between text-[#303B38]/85 pl-3 text-[14px]">
            <span>{t('reports.officeRent')}</span>
            <span className="font-mono-num">{formatCurrency(report.rent)}</span>
          </div>
          <div className="flex justify-between text-[#303B38]/85 pl-3 text-[14px]">
            <span>{t('reports.serverMaint')}</span>
            <span className="font-mono-num">{formatCurrency(report.maintenance)}</span>
          </div>
          <div className="flex justify-between text-[#303B38]/85 pl-3 text-[14px]">
            <span>{t('reports.marketingSpend')}</span>
            <span className="font-mono-num">{formatCurrency(report.marketing)}</span>
          </div>
          <div className="flex justify-between text-[#303B38]/85 pl-3 text-[14px]">
            <span>{t('reports.rdOpsHiring')}</span>
            <span className="font-mono-num">{formatCurrency(report.devAndMisc)}</span>
          </div>
          <div className="flex justify-between text-[#303B38]/85 pl-3 text-[14px]">
            <span>{t('reports.taxesInterest')}</span>
            <span className="font-mono-num">{formatCurrency(report.taxes + report.interest)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center bg-[#FAF8F2] border border-[#303B38]/25 p-3">
          <div>
            <div className="text-[13px] text-[#303B38]/80">{t('reports.activeCustomers')}</div>
            <div className="font-mono-num text-[18px] font-bold text-[#303B38] mt-0.5">
              {report.activeCustomers}
            </div>
          </div>
          <div>
            <div className="text-[13px] text-[#303B38]/80">{t('reports.teamMorale')}</div>
            <div className="font-mono-num text-[18px] font-bold text-[#303B38] mt-0.5">
              {report.avgMorale}%
            </div>
          </div>
          <div>
            <div className="text-[13px] text-[#303B38]/80">{t('reports.headcount')}</div>
            <div className="font-mono-num text-[18px] font-bold text-[#303B38] mt-0.5">
              {report.headcount}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 bg-[#EAE5D8] border border-[#303B38]/20 p-3.5">
          <p className="text-[15px] text-[#303B38] leading-relaxed">{summaryNote}</p>
          <button
            type="button"
            onClick={handleToggleRead}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF8F2] hover:bg-[#F3F0E7] border border-[#303B38]/30 text-[13px] font-bold text-[#303B38] cursor-pointer shrink-0"
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

        <button
          type="button"
          onClick={onContinue}
          className="min-h-[46px] w-full py-3 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] font-bold text-[15px] cursor-pointer transition-colors"
        >
          {t('reports.startNextMonth')}
        </button>
      </div>
    </ModalFrame>
  );
};
