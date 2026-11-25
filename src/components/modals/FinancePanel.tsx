import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  calculateFounderSalary,
  calculateMonthlyMaintenance,
  calculateMonthlyPayroll,
  estimateMonthlyBurn,
  getFounderSalaryProfile,
  MAX_FOUNDER_SALARY,
  MIN_FOUNDER_SALARY,
} from '@/src/game/systems/financeSystem';
import { useLocalization } from '@/src/hooks/useLocalization';
import { getLocalizedFounderSalaryLabelAndSummary } from '@/src/localization/i18n';
import { GameCommand, GameState } from '@/src/types/game';
import { Tooltip } from '@/src/components/Tooltip';
import { ModalFrame } from './ModalFrame';

interface FinancePanelProps {
  state: GameState;
  onDispatch: (cmd: GameCommand) => void;
  onClose: () => void;
}

const SALARY_PRESET_VALUES = [0, 1500, 3000, 6000, 10000];

export const FinancePanel: React.FC<FinancePanelProps> = ({ state, onDispatch, onClose }) => {
  const { locale, t, formatCurrency } = useLocalization();
  const f = state.finance;
  const burn = estimateMonthlyBurn(state);
  const payroll = calculateMonthlyPayroll(state);
  const founderSalary = calculateFounderSalary(state);
  const maint = calculateMonthlyMaintenance(state);
  const availableCredit = Math.max(0, f.creditLimit - f.totalDebt);
  const personalCash = state.founder.personalCash ?? 0;
  const investorTrust = Math.round(state.founder.investorTrust ?? 55);

  const [draftSalary, setDraftSalary] = useState<number>(founderSalary);

  useEffect(() => {
    setDraftSalary(founderSalary);
  }, [founderSalary]);

  useEffect(() => {
    if (state.tutorial?.active && !state.tutorial.completed && !state.tutorial.skipped) {
      onDispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_FINANCE' });
    }
  }, [onDispatch, state.tutorial?.active, state.tutorial?.completed, state.tutorial?.skipped]);

  const previewProfile = getFounderSalaryProfile(draftSalary, f.cash);
  const localizedTier = getLocalizedFounderSalaryLabelAndSummary(
    previewProfile.tier,
    f.cash < 5000,
    locale
  );
  const formatSigned = (val: number) => `${val > 0 ? '+' : ''}${val}`;

  return (
    <ModalFrame
      title={t('finance.title')}
      subtitle={t('finance.subtitle', {
        valuation: formatCurrency(f.valuation),
        ownership: 100 - f.equityDilutionPct,
        trust: investorTrust,
      })}
      onClose={onClose}
    >
      <div className="space-y-6">
        {/* Key Financial Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tooltip hintKey="tooltips.financeCompanyCash" wrapperClassName="block min-w-0">
            <div
              tabIndex={0}
              className={`border p-4 h-full cursor-help ${
                f.cash < 5000
                  ? 'bg-[#D68B7B]/18 border-[#D68B7B]'
                  : 'bg-[#FAF8F2] border-[#303B38]/25'
              }`}
            >
              <div className="text-[13px] text-[#303B38]/80">{t('finance.companyCash')}</div>
              <div className="text-[20px] sm:text-[24px] font-mono-num font-bold text-[#303B38] mt-1">
                {formatCurrency(f.cash)}
              </div>
            </div>
          </Tooltip>
          <Tooltip hintKey="tooltips.financeProjectedNet" wrapperClassName="block min-w-0">
            <div
              tabIndex={0}
              className={`border p-4 h-full cursor-help ${
                burn.netMonthly >= 0
                  ? 'bg-[#78978A]/18 border-[#78978A]'
                  : 'bg-[#FAF8F2] border-[#303B38]/25'
              }`}
            >
              <div className="text-[13px] text-[#303B38]/80">{t('finance.projectedMonthlyNet')}</div>
              <div className="text-[20px] sm:text-[24px] font-mono-num font-bold text-[#303B38] mt-1">
                {burn.netMonthly >= 0 ? '+' : ''}
                {formatCurrency(burn.netMonthly)}
              </div>
              <div className="text-[12px] text-[#303B38]/75 font-mono-num mt-1">
                {t('finance.burnRateLabel', { amount: formatCurrency(burn.projectedExpenses) })}
              </div>
            </div>
          </Tooltip>
          <Tooltip hintKey="tooltips.financePersonalCash" wrapperClassName="block min-w-0">
            <div tabIndex={0} className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 h-full cursor-help">
              <div className="text-[13px] text-[#303B38]/80">{t('finance.personalCash')}</div>
              <div className="text-[20px] sm:text-[24px] font-mono-num font-bold text-[#303B38] mt-1">
                {formatCurrency(personalCash)}
              </div>
            </div>
          </Tooltip>
          <Tooltip hintKey="tooltips.financeCreditDebt" wrapperClassName="block min-w-0">
            <div
              tabIndex={0}
              className={`border p-4 h-full cursor-help ${
                f.totalDebt > 0
                  ? 'bg-[#D68B7B]/15 border-[#D68B7B]/70'
                  : 'bg-[#FAF8F2] border-[#303B38]/25'
              }`}
            >
              <div className="text-[13px] text-[#303B38]/80">{t('finance.creditDebt')}</div>
              <div className="text-[20px] sm:text-[24px] font-mono-num font-bold text-[#303B38] mt-1">
                {formatCurrency(f.totalDebt)}
              </div>
            </div>
          </Tooltip>
        </div>

        {/* Founder Salary & Investor Trust Control */}
        <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-[20px] text-[#303B38]">
                {t('finance.founderSalaryTitle')}
              </h3>
              <p className="text-[14px] text-[#303B38]/80 mt-0.5">
                {t('finance.founderSalaryDesc')}
              </p>
            </div>
            <div className="text-left sm:text-right font-mono-num">
              <div className="text-[22px] font-bold text-[#303B38]">
                {formatCurrency(draftSalary)}
                {t('common.perMonth')}
              </div>
              <div className="text-[13px] text-[#303B38]/80">
                {t('finance.activeTrust', {
                  salary: formatCurrency(founderSalary),
                  trust: investorTrust,
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <input
              type="range"
              min={MIN_FOUNDER_SALARY}
              max={MAX_FOUNDER_SALARY}
              step={250}
              value={draftSalary}
              onChange={(e) => setDraftSalary(Number(e.target.value))}
              aria-label={t('finance.founderSalaryTitle')}
              className="w-full accent-[#78978A] cursor-pointer"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {SALARY_PRESET_VALUES.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setDraftSalary(val);
                      onDispatch({ type: 'SET_FOUNDER_SALARY', amount: val });
                    }}
                    className={`min-h-[44px] px-3 py-1.5 text-[14px] font-bold border cursor-pointer whitespace-nowrap ${
                      founderSalary === val
                        ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                        : 'bg-[#F3F0E7] hover:bg-[#EAE5D8] border-[#303B38]/30 text-[#303B38]'
                    }`}
                  >
                    {val === 0
                      ? t('finance.presetLean', { amount: formatCurrency(0) })
                      : formatCurrency(val)}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Tooltip hintKey="tooltips.financeApplySalary">
                  <button
                    type="button"
                    disabled={draftSalary === founderSalary}
                    onClick={() => onDispatch({ type: 'SET_FOUNDER_SALARY', amount: draftSalary })}
                    className="min-h-[44px] px-4 py-2 bg-[#78978A] hover:bg-[#6A897C] disabled:opacity-40 border border-[#303B38] text-[#303B38] text-[14px] font-bold cursor-pointer whitespace-nowrap"
                  >
                    {t('finance.applySalary')}
                  </button>
                </Tooltip>
                <Tooltip hintKey="finance.investTooltip" hintVars={{ amount: formatCurrency(2500) }}>
                  <button
                    type="button"
                    disabled={personalCash < 2500}
                    onClick={() => onDispatch({ type: 'INJECT_PERSONAL_CASH', amount: 2500 })}
                    className="min-h-[44px] px-4 py-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] disabled:opacity-40 border border-[#303B38]/35 text-[14px] font-bold text-[#303B38] cursor-pointer whitespace-nowrap"
                  >
                    {t('finance.investPersonal', { amount: formatCurrency(2500) })}
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className="border-t border-[#303B38]/20 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[14px]">
            <div className="space-y-0.5">
              <span className="font-bold text-[#303B38]">{localizedTier.label}</span>
              <span className="text-[#303B38]/85"> · {localizedTier.summary}</span>
            </div>
            <div className="flex flex-wrap gap-3 font-mono-num text-[13px] text-[#303B38] shrink-0">
              <span>{t('finance.moraleImpact', { val: formatSigned(previewProfile.moralePerDay) })}</span>
              <span>
                {t('finance.trustImpact', { val: formatSigned(previewProfile.investorTrustPerDay) })}
              </span>
              <span>
                {t('finance.respectImpact', { val: formatSigned(previewProfile.respectPerDay) })}
              </span>
            </div>
          </div>
        </div>

        {/* Progressive Disclosure: Detailed Ledger, Credit Line & P&L History */}
        <details className="bg-[#FAF8F2] border border-[#303B38]/25 p-4">
          <summary className="min-h-[40px] cursor-pointer font-bold text-[15px] text-[#303B38] select-none flex items-center justify-between gap-2 list-none">
            <span>{t('finance.detailsToggle')}</span>
            <ChevronDown className="w-4 h-4 text-[#303B38]/75 shrink-0" aria-hidden="true" />
          </summary>

          <div className="mt-4 pt-4 border-t border-[#303B38]/20 space-y-6">
            {/* Current Month Ledger & Obligations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#F3F0E7] border border-[#303B38]/25 p-4 space-y-2 text-[15px]">
            <h3 className="font-bold text-[20px] text-[#303B38] mb-2">
              {t('finance.runningLedgerTitle', { month: state.month })}
            </h3>
            <div className="flex justify-between">
              <span className="text-[#303B38]/80">{t('finance.revMtd')}</span>
              <span className="font-mono-num font-bold text-[#303B38]">
                {formatCurrency(f.currentMonthRevenue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#303B38]/80">{t('finance.mktMtd')}</span>
              <span className="font-mono-num text-[#303B38]">
                {formatCurrency(f.currentMonthMarketing)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#303B38]/80">{t('finance.rdMtd')}</span>
              <span className="font-mono-num text-[#303B38]">
                {formatCurrency(f.currentMonthDevCosts)}
              </span>
            </div>
            <div className="border-t border-[#303B38]/20 pt-2 mt-2 flex justify-between">
              <span className="text-[#303B38]/80">{t('finance.eomPayroll')}</span>
              <span className="font-mono-num font-bold text-[#303B38]">
                {formatCurrency(payroll)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#303B38]/80">{t('finance.eomFounder')}</span>
              <span className="font-mono-num font-bold text-[#303B38]">
                {formatCurrency(founderSalary)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#303B38]/80">{t('finance.eomRent')}</span>
              <span className="font-mono-num font-bold text-[#303B38]">
                {formatCurrency(state.office.monthlyRent)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#303B38]/80">{t('finance.eomMaint')}</span>
              <span className="font-mono-num font-bold text-[#303B38]">
                {formatCurrency(maint)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#303B38]/80">{t('finance.taxRate')}</span>
              <span className="font-mono-num text-[#303B38]">{Math.round(f.taxRate * 100)}%</span>
            </div>
          </div>

          <div className="bg-[#F3F0E7] border border-[#303B38]/25 p-4 space-y-3">
            <h3 className="font-bold text-[20px] text-[#303B38]">{t('finance.creditLineTitle')}</h3>
            <p className="text-[15px] text-[#303B38]/85 leading-relaxed">
              {t('finance.creditLineDesc', {
                limit: formatCurrency(f.creditLimit),
                available: formatCurrency(availableCredit),
              })}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={availableCredit < 2500}
                onClick={() => onDispatch({ type: 'TAKE_LOAN', amount: 5000 })}
                className="min-h-[44px] px-4 py-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] disabled:opacity-40 border border-[#303B38]/35 text-[14px] font-bold text-[#303B38] cursor-pointer"
              >
                {t('finance.borrowBtn', { amount: formatCurrency(5000) })}
              </button>
              <button
                type="button"
                disabled={f.totalDebt <= 0 || f.cash < 1000}
                onClick={() => onDispatch({ type: 'REPAY_LOAN', amount: 5000 })}
                className="min-h-[44px] px-4 py-2 bg-[#78978A] hover:bg-[#6A897C] disabled:opacity-40 border border-[#303B38] text-[14px] text-[#303B38] font-bold cursor-pointer"
              >
                {t('finance.repayBtn', { amount: formatCurrency(5000) })}
              </button>
            </div>
          </div>
        </div>

        {/* Historical Monthly P&L */}
        <div>
          <h3 className="font-bold text-[20px] text-[#303B38] mb-2">
            {t('finance.historyTitle')}
          </h3>
          {state.monthlyHistory.length === 0 ? (
            <p className="text-[15px] text-[#303B38]/80">{t('finance.noHistory')}</p>
          ) : (
            <div className="overflow-x-auto border border-[#303B38]/25 bg-[#FAF8F2]">
              <table className="w-full text-[14px] text-left">
                <thead className="bg-[#EAE5D8] text-[#303B38] border-b border-[#303B38]/25">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">{t('finance.colPeriod')}</th>
                    <th className="py-2.5 px-3 text-right font-bold">{t('finance.colRevenue')}</th>
                    <th className="py-2.5 px-3 text-right font-bold">{t('finance.colExpenses')}</th>
                    <th className="py-2.5 px-3 text-right font-bold">{t('finance.colTaxes')}</th>
                    <th className="py-2.5 px-3 text-right font-bold">{t('finance.colNetProfit')}</th>
                    <th className="py-2.5 px-3 text-right font-bold">{t('finance.colEndingCash')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#303B38]/15 font-mono-num text-[#303B38]">
                  {[...state.monthlyHistory].reverse().map((r) => (
                    <tr key={`${r.year}-${r.month}`}>
                      <td className="py-2.5 px-3">
                        {locale === 'vi-VN'
                          ? `N${r.year} T${r.month}`
                          : `Y${r.year} M${r.month}`}
                      </td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(r.revenue)}</td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(r.expenses)}</td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(r.taxes)}</td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        {r.netProfit >= 0 ? '+' : ''}
                        {formatCurrency(r.netProfit)}
                      </td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(r.endingCash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </div>
        </details>
      </div>
    </ModalFrame>
  );
};
