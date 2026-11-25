import React, { useEffect, useState } from 'react';
import { ChevronDown, Plus, Rocket, Sparkles, Wrench, Zap } from 'lucide-react';
import { FEATURE_TEMPLATES, PRODUCT_CATEGORIES } from '@/src/game/data/products';
import { useLocalization } from '@/src/hooks/useLocalization';
import { getFeatureLocalized, getProductCategoryLocalized } from '@/src/localization/i18n';
import { GameCommand, GameState, ProductCategory, RevenueModel } from '@/src/types/game';
import { ModalFrame } from './ModalFrame';

interface ProductPanelProps {
  state: GameState;
  onDispatch: (cmd: GameCommand) => void;
  onClose: () => void;
}

export const ProductPanel: React.FC<ProductPanelProps> = ({ state, onDispatch, onClose }) => {
  const { locale, t, formatCurrency } = useLocalization();
  const isTutorialCreateStep =
    Boolean(state.tutorial?.active) &&
    !state.tutorial?.completed &&
    !state.tutorial?.skipped &&
    state.tutorial?.currentStep === 3;

  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ProductCategory>('SAAS');
  const [newModel, setNewModel] = useState<RevenueModel>('SUBSCRIPTION');
  const [showCreate, setShowCreate] = useState(isTutorialCreateStep);

  useEffect(() => {
    if (isTutorialCreateStep) {
      setShowCreate(true);
    }
  }, [isTutorialCreateStep]);

  return (
    <ModalFrame
      title={t('products.title')}
      subtitle={t('products.subtitle')}
      onClose={onClose}
    >
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="text-[15px] text-[#303B38]/85">
          {t('products.portfolioCount', { count: state.products.length })}
        </div>
        <button
          type="button"
          data-tutorial-target="product-new-idea-btn"
          onClick={() => setShowCreate(!showCreate)}
          className="min-h-[44px] flex items-center gap-2 px-4 py-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] font-bold text-[14px] cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('products.newIdeaBtn')}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            onDispatch({
              type: 'CREATE_PRODUCT',
              name: newName.trim(),
              category: newCategory,
              revenueModel: newModel,
            });
            setNewName('');
            setShowCreate(false);
          }}
          className="bg-[#FAF8F2] border border-[#303B38] p-4 mb-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label htmlFor="new-product-name" className="block text-[13px] font-bold text-[#303B38] mb-1">
              {t('products.productName')}
            </label>
            <input
              id="new-product-name"
              data-tutorial-target="product-name-input"
              type="text"
              required
              placeholder={t('products.productPlaceholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full min-h-[44px] bg-[#F3F0E7] border border-[#303B38]/35 px-3 py-2 text-[14px] text-[#303B38]"
            />
          </div>
          <div>
            <label htmlFor="new-product-cat" className="block text-[13px] font-bold text-[#303B38] mb-1">
              {t('products.category')}
            </label>
            <select
              id="new-product-cat"
              value={newCategory}
              onChange={(e) => {
                const cat = e.target.value as ProductCategory;
                setNewCategory(cat);
                setNewModel(PRODUCT_CATEGORIES[cat].defaultModel);
              }}
              className="w-full min-h-[44px] bg-[#F3F0E7] border border-[#303B38]/35 px-3 py-2 text-[14px] text-[#303B38]"
            >
              {Object.values(PRODUCT_CATEGORIES).map((c) => (
                <option key={c.category} value={c.category}>
                  {getProductCategoryLocalized(c.category, locale).label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-product-model" className="block text-[13px] font-bold text-[#303B38] mb-1">
              {t('products.revenueModel')}
            </label>
            <select
              id="new-product-model"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value as RevenueModel)}
              className="w-full min-h-[44px] bg-[#F3F0E7] border border-[#303B38]/35 px-3 py-2 text-[14px] text-[#303B38]"
            >
              <option value="SUBSCRIPTION">{t('products.models.SUBSCRIPTION')}</option>
              <option value="FREEMIUM">{t('products.models.FREEMIUM')}</option>
              <option value="ONE_TIME">{t('products.models.ONE_TIME')}</option>
              <option value="ENTERPRISE_LICENSE">{t('products.models.ENTERPRISE_LICENSE')}</option>
            </select>
          </div>
          <button
            type="submit"
            data-tutorial-target="product-create-submit"
            className="min-h-[44px] bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] font-bold py-2 px-4 text-[14px] cursor-pointer transition-colors"
          >
            {t('products.startRd', {
              cost: formatCurrency(Math.round(PRODUCT_CATEGORIES[newCategory].baseDevCost * 0.45)),
            })}
          </button>
        </form>
      )}

      {(() => {
        const firstSprintProdId = state.products.find(
          (p) => p.stage !== 'MVP_LIVE' && p.stage !== 'MATURE' && p.developmentProgress < 100
        )?.id;
        const firstLaunchProdId = state.products.find(
          (p) => p.stage !== 'MVP_LIVE' && p.stage !== 'MATURE' && p.developmentProgress >= 100
        )?.id;
        return state.products.length === 0 ? (
          <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-6 text-center text-[15px] text-[#303B38]/80">
            {t('drawer.noProductHint')}
          </div>
        ) : (
          <div className="space-y-4">
            {state.products.map((prod) => {
              const isLive = prod.stage === 'MVP_LIVE' || prod.stage === 'MATURE';
              const catLoc = getProductCategoryLocalized(prod.category, locale);
              return (
                <div key={prod.id} className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-bold text-[20px] text-[#303B38]">{prod.name}</h3>
                        <span className="text-[13px] px-2.5 py-0.5 bg-[#EAE5D8] border border-[#303B38]/25 text-[#303B38] font-mono-num font-bold">
                          v{prod.version}.0 · {t(`products.stages.${prod.stage}`)}
                        </span>
                      </div>
                      <div className="text-[14px] text-[#303B38]/80 mt-1">
                        {catLoc.label} · {t(`products.models.${prod.revenueModel}`)} ·{' '}
                        {t('products.maintPerMonth', {
                          cost: formatCurrency(prod.monthlyMaintenanceCost),
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!isLive && prod.developmentProgress < 100 && (
                        <button
                          type="button"
                          data-tutorial-target={
                            prod.id === firstSprintProdId ? 'product-build-sprint-btn' : undefined
                          }
                          onClick={() => onDispatch({ type: 'RUN_PROTOTYPE_SPRINT', productId: prod.id })}
                          className="min-h-[44px] flex items-center gap-1.5 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38] text-[#303B38] font-bold px-3.5 py-2 text-[14px] cursor-pointer"
                        >
                          <Zap className="w-4 h-4" />
                          {t('products.buildSprintBtn', { cost: formatCurrency(400) })}
                        </button>
                      )}

                      {!isLive && prod.developmentProgress >= 100 && (
                        <button
                          type="button"
                          data-tutorial-target={
                            prod.id === firstLaunchProdId ? 'product-launch-mvp-btn' : undefined
                          }
                          onClick={() => onDispatch({ type: 'LAUNCH_PRODUCT_MVP', productId: prod.id })}
                          className="min-h-[44px] flex items-center gap-1.5 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] font-bold px-4 py-2 text-[14px] cursor-pointer"
                        >
                          <Rocket className="w-4 h-4" />
                          {t('products.launchMvpBtn')}
                        </button>
                      )}

                  {isLive && (
                    <button
                      type="button"
                      onClick={() => onDispatch({ type: 'RELEASE_PRODUCT_UPDATE', productId: prod.id })}
                      className="min-h-[44px] flex items-center gap-1.5 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] font-bold px-4 py-2 text-[14px] cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      {t('products.shipUpdateBtn', { cost: formatCurrency(700) })}
                    </button>
                  )}

                  {prod.bugs > 0 && (
                    <button
                      type="button"
                      onClick={() => onDispatch({ type: 'FIX_PRODUCT_BUGS', productId: prod.id })}
                      className="min-h-[44px] flex items-center gap-1.5 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[#303B38] font-bold px-3.5 py-2 text-[14px] cursor-pointer"
                    >
                      <Wrench className="w-4 h-4" />
                      {t('products.fixBugsBtn', {
                        count: prod.bugs,
                        cost: formatCurrency(prod.bugs * 120),
                      })}
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {!isLive && (
                <div>
                  <div className="flex justify-between text-[13px] text-[#303B38]/85 mb-1">
                    <span>{t('products.mvpReadiness')}</span>
                    <span className="font-mono-num font-bold text-[#303B38]">
                      {Math.round(prod.developmentProgress)}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-[#EAE5D8] border border-[#303B38]/25 overflow-hidden">
                    <div
                      className="h-full bg-[#78978A] transition-all"
                      style={{ width: `${Math.min(100, Math.round(prod.developmentProgress))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Core Product Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 border-t border-b border-[#303B38]/20 py-3">
                <div>
                  <div className="text-[13px] text-[#303B38]/80">{t('products.quality')}</div>
                  <div className="font-mono-num text-[20px] text-[#303B38] font-bold">
                    {Math.round(prod.quality)}/100
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-[#303B38]/80">{t('products.openBugs')}</div>
                  <div className="font-mono-num text-[20px] text-[#303B38] font-bold">{prod.bugs}</div>
                </div>
                <div>
                  <div className="text-[13px] text-[#303B38]/80">{t('products.satisfaction')}</div>
                  <div className="font-mono-num text-[20px] text-[#303B38] font-bold">
                    {Math.round(prod.customerSatisfaction)}%
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-[#303B38]/80">{t('products.payingUsers')}</div>
                  <div className="font-mono-num text-[20px] text-[#303B38] font-bold">
                    {prod.payingCustomers}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-[#303B38]/80">{t('products.estMonthlyRev')}</div>
                  <div className="font-mono-num text-[20px] text-[#303B38] font-bold">
                    {formatCurrency(prod.monthlyRevenue)}
                  </div>
                </div>
              </div>

              {/* Collapsible Pricing + Feature Queue */}
              <details className="border-t border-[#303B38]/15 pt-2">
                <summary className="min-h-[40px] cursor-pointer font-bold text-[14px] text-[#303B38] select-none flex items-center justify-between gap-2 list-none">
                  <span>{t('products.detailsToggle')}</span>
                  <ChevronDown className="w-4 h-4 text-[#303B38]/75 shrink-0" aria-hidden="true" />
                </summary>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                  <div>
                    <div className="text-[15px] font-bold text-[#303B38] mb-2">
                      {t('products.featuresRoadmap', {
                        done: prod.features.filter((f) => f.completed).length,
                        total: prod.features.length,
                      })}
                    </div>
                    <div className="space-y-1.5">
                      {prod.features.map((feat) => {
                        const pct = Math.min(100, Math.round((feat.effortProgress / feat.effortRequired) * 100));
                        const featLoc = getFeatureLocalized(feat.name, feat.description, locale);
                        return (
                          <div
                            key={feat.id}
                            className={`px-3 py-2 text-[14px] flex items-center justify-between gap-2 border ${
                              feat.completed
                                ? 'bg-[#78978A]/20 border-[#303B38]/30'
                                : 'bg-[#F3F0E7] border-[#303B38]/20'
                            }`}
                          >
                            <span className="text-[#303B38] font-bold">{featLoc.name}</span>
                            <span className="font-mono-num text-[13px] text-[#303B38]/85">
                              {feat.completed ? t('products.shipped') : `${pct}%`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-[#F3F0E7] border border-[#303B38]/25 px-3 py-2">
                      <span className="text-[14px] text-[#303B38] font-bold">
                        {t('products.pricePerCustomer')}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onDispatch({
                              type: 'SET_PRODUCT_PRICE',
                              productId: prod.id,
                              price: prod.pricePerCustomer - 5,
                            })
                          }
                          className="min-h-[42px] min-w-[44px] px-3 py-1 bg-[#EAE5D8] hover:bg-[#78978A]/35 border border-[#303B38]/30 text-[14px] font-bold text-[#303B38] cursor-pointer"
                        >
                          -5
                        </button>
                        <span className="font-mono-num text-[15px] font-bold text-[#303B38] min-w-[70px] text-center">
                          {formatCurrency(prod.pricePerCustomer)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onDispatch({
                              type: 'SET_PRODUCT_PRICE',
                              productId: prod.id,
                              price: prod.pricePerCustomer + 5,
                            })
                          }
                          className="min-h-[42px] min-w-[44px] px-3 py-1 bg-[#EAE5D8] hover:bg-[#78978A]/35 border border-[#303B38]/30 text-[14px] font-bold text-[#303B38] cursor-pointer"
                        >
                          +5
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-[15px] font-bold text-[#303B38] mb-2">
                        {t('products.addFeatureTitle')}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {FEATURE_TEMPLATES.map((tpl, idx) => {
                          const tplLoc = getFeatureLocalized(tpl.name, tpl.description, locale);
                          return (
                            <button
                              key={tpl.name}
                              type="button"
                              onClick={() =>
                                onDispatch({
                                  type: 'ADD_PRODUCT_FEATURE',
                                  productId: prod.id,
                                  templateIndex: idx,
                                })
                              }
                              className="min-h-[44px] text-left bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/25 px-3 py-2 text-[13px] cursor-pointer"
                            >
                              <div className="text-[#303B38] font-bold text-[14px] truncate">
                                {tplLoc.name}
                              </div>
                              <div className="text-[13px] font-mono-num text-[#303B38]/80">
                                {formatCurrency(tpl.cost)} ·{' '}
                                {t('products.qualityBoost', { boost: tpl.qualityBoost })}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          );
        })}
          </div>
        );
      })()}
    </ModalFrame>
  );
};
