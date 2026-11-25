import React, { useState } from 'react';
import { ChevronDown, FileCheck2, Handshake, Megaphone } from 'lucide-react';
import { MARKETING_CHANNELS } from '@/src/game/data/products';
import { useLocalization } from '@/src/hooks/useLocalization';
import { getChannelLocalized, getProductCategoryLocalized } from '@/src/localization/i18n';
import { CustomerSegment, GameCommand, GameState, MarketingChannel } from '@/src/types/game';
import { ModalFrame } from './ModalFrame';

interface MarketPanelProps {
  state: GameState;
  onDispatch: (cmd: GameCommand) => void;
  onClose: () => void;
}

export const MarketPanel: React.FC<MarketPanelProps> = ({ state, onDispatch, onClose }) => {
  const { locale, t, formatCurrency } = useLocalization();
  const [selectedProductId, setSelectedProductId] = useState(state.products[0]?.id ?? '');
  const [segment, setSegment] = useState<CustomerSegment>('SMB');
  const [budget, setBudget] = useState<number>(120);

  const liveProducts = state.products.filter((p) => p.stage === 'MVP_LIVE' || p.stage === 'MATURE');

  const segmentLabel = (seg: CustomerSegment) =>
    seg === 'CONSUMERS'
      ? t('market.segmentConsumers')
      : seg === 'SMB'
        ? t('market.segmentSmb')
        : t('market.segmentEnterprise');

  return (
    <ModalFrame
      title={t('market.title')}
      subtitle={t('market.subtitle')}
      onClose={onClose}
    >
      <div className="space-y-6">
        {/* Marketing Channel Launcher */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <h3 className="font-bold text-[20px] text-[#303B38] flex items-center gap-2">
              <Megaphone className="w-5 h-5" />
              {t('market.channelsTitle')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center gap-2 text-[14px] min-w-0">
              <select
                aria-label={t('drawer.assignedProduct')}
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="min-h-[44px] w-full lg:w-auto min-w-0 bg-[#FAF8F2] border border-[#303B38]/35 px-3 py-2 text-[#303B38]"
              >
                {state.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (
                    {p.stage === 'MVP_LIVE' || p.stage === 'MATURE'
                      ? t('market.productStatusLive')
                      : t('market.productStatusNotLive')}
                    )
                  </option>
                ))}
              </select>
              <select
                aria-label={t('market.segmentSmb')}
                value={segment}
                onChange={(e) => setSegment(e.target.value as CustomerSegment)}
                className="min-h-[44px] w-full lg:w-auto min-w-0 bg-[#FAF8F2] border border-[#303B38]/35 px-3 py-2 text-[#303B38]"
              >
                <option value="CONSUMERS">{t('market.segmentConsumers')}</option>
                <option value="SMB">{t('market.segmentSmb')}</option>
                <option value="ENTERPRISE">{t('market.segmentEnterprise')}</option>
              </select>
              <label className="sm:col-span-2 lg:flex-initial flex items-center justify-between gap-2 text-[14px] text-[#303B38] font-mono-num bg-[#FAF8F2] border border-[#303B38]/25 px-3 min-h-[44px] min-w-0">
                <span className="shrink-0">{t('market.dailyBudget', { budget: formatCurrency(budget) })}</span>
                <input
                  type="range"
                  min={50}
                  max={500}
                  step={10}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="accent-[#78978A] cursor-pointer min-w-0 w-28 sm:w-32"
                />
              </label>
            </div>
          </div>

          {liveProducts.length === 0 && (
            <div className="bg-[#EAE5D8] border border-[#303B38]/30 px-3.5 py-2.5 text-[14px] text-[#303B38] mb-3">
              {t('market.launchMvpWarning')}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {(Object.keys(MARKETING_CHANNELS) as MarketingChannel[]).map((chKey, chIdx) => {
              const ch = MARKETING_CHANNELS[chKey];
              const chLoc = getChannelLocalized(chKey, locale);
              const activeCamp = state.campaigns.find(
                (c) => c.channel === chKey && c.productId === selectedProductId && c.active
              );
              return (
                <div
                  key={chKey}
                  className={`border p-4 flex flex-col justify-between gap-3 ${
                    activeCamp
                      ? 'bg-[#78978A]/18 border-[#303B38]'
                      : 'bg-[#FAF8F2] border-[#303B38]/25'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-[16px] text-[#303B38]">{chLoc.label}</span>
                      <span className="text-[13px] font-mono-num text-[#303B38]/80">
                        {chLoc.speedLabel} · {t('market.cacLabel', { cac: formatCurrency(ch.cacBase) })}
                      </span>
                    </div>
                    <p className="text-[14px] text-[#303B38]/85 mt-1.5 leading-relaxed">
                      {chLoc.description}
                    </p>
                    {activeCamp && (
                      <div className="mt-2.5 text-[13px] font-mono-num font-bold text-[#303B38]">
                        {t('market.activeCampSummary', {
                          budget: formatCurrency(activeCamp.dailyBudget),
                          count: activeCamp.customersAcquired,
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    data-tutorial-target={chIdx === 0 ? 'market-launch-campaign-btn' : undefined}
                    onClick={() =>
                      onDispatch({
                        type: 'TOGGLE_CAMPAIGN',
                        channel: chKey,
                        productId: selectedProductId,
                        segment,
                        dailyBudget: Math.max(ch.minDailyBudget, Math.min(ch.maxDailyBudget, budget)),
                      })
                    }
                    className={`min-h-[44px] w-full py-2.5 px-4 text-[14px] font-bold border cursor-pointer transition-colors ${
                      activeCamp
                        ? 'bg-[#303B38] hover:bg-[#303B38]/90 border-[#303B38] text-[#F3F0E7]'
                        : 'bg-[#78978A] hover:bg-[#6A897C] border-[#303B38] text-[#303B38]'
                    }`}
                  >
                    {activeCamp ? t('market.pauseCampaign') : t('market.launchCampaign')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* B2B Sales & Legal Contracts */}
        <section className="border-t border-[#303B38]/20 pt-5">
          <h3 className="font-bold text-[20px] text-[#303B38] flex items-center gap-2 mb-3">
            <Handshake className="w-5 h-5" />
            {t('market.b2bTitle')}
          </h3>
          {state.contracts.filter((c) => c.status !== 'EXPIRED').length === 0 ? (
            <p className="text-[15px] text-[#303B38]/80">{t('market.noContracts')}</p>
          ) : (
            <div className="space-y-3">
              {state.contracts
                .filter((c) => c.status !== 'EXPIRED')
                .map((ctr) => (
                  <div
                    key={ctr.id}
                    className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[16px] text-[#303B38]">
                          {ctr.clientName}
                        </span>
                        <span className="text-[13px] px-2 py-0.5 bg-[#EAE5D8] border border-[#303B38]/20 text-[#303B38]">
                          {segmentLabel(ctr.segment)} · {t(`market.contractStatuses.${ctr.status}`)}
                        </span>
                      </div>
                      <div className="text-[14px] font-mono-num text-[#303B38]/85 mt-1">
                        {t('market.contractTerm', {
                          value: formatCurrency(ctr.monthlyValue),
                          months: ctr.monthsRemaining,
                          upfront: formatCurrency(ctr.upfrontBonus),
                          quality: ctr.requiredQuality,
                        })}
                      </div>
                    </div>

                    {ctr.status === 'PIPELINE' && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={ctr.legalReviewed}
                          onClick={() =>
                            onDispatch({ type: 'REVIEW_CONTRACT_LEGAL', contractId: ctr.id })
                          }
                          className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] disabled:opacity-50 border border-[#303B38]/35 text-[14px] font-bold text-[#303B38] cursor-pointer"
                        >
                          <FileCheck2 className="w-4 h-4" />
                          {ctr.legalReviewed ? t('market.legalCleared') : t('market.legalReview')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDispatch({ type: 'PITCH_CONTRACT', contractId: ctr.id })}
                          className="min-h-[44px] px-4 py-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] font-bold text-[14px] cursor-pointer"
                        >
                          {t('market.pitchAndSign')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Competitors (Progressive Disclosure) */}
        <details className="bg-[#FAF8F2] border border-[#303B38]/25 p-4">
          <summary className="min-h-[40px] cursor-pointer font-bold text-[15px] text-[#303B38] select-none flex items-center justify-between gap-2 list-none">
            <span>{t('market.detailsToggle')}</span>
            <ChevronDown className="w-4 h-4 text-[#303B38]/75 shrink-0" aria-hidden="true" />
          </summary>
          <div className="mt-3 pt-3 border-t border-[#303B38]/15">
            <h3 className="font-bold text-[17px] text-[#303B38] mb-2.5">
              {t('market.competitorsTitle')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {state.competitors.map((comp) => (
                <div key={comp.id} className="bg-[#F3F0E7] border border-[#303B38]/25 p-3.5 text-[15px]">
                  <div className="font-bold text-[#303B38]">{comp.name}</div>
                  <div className="text-[13px] text-[#303B38]/80 mt-0.5">
                    {getProductCategoryLocalized(comp.category, locale).label}
                  </div>
                  <div className="mt-2 font-mono-num text-[14px] text-[#303B38] flex justify-between">
                    <span>{t('market.shareLabel', { share: comp.marketShare })}</span>
                    <span>{t('market.qualityLabel', { qual: Math.round(comp.productQuality) })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>
    </ModalFrame>
  );
};
