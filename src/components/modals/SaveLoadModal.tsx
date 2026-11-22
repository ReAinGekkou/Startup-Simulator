import React, { useState } from 'react';
import { FolderOpen, Save, Trash2 } from 'lucide-react';
import { useLocalization } from '@/src/hooks/useLocalization';
import { listSaveSlots } from '@/src/services/saveService';
import { ModalFrame } from './ModalFrame';

interface SaveLoadModalProps {
  canSaveCurrent: boolean;
  onSaveSlot: (slotId: string, label?: string) => void;
  onLoadSlot: (slotId: string) => boolean;
  onDeleteSlot: (slotId: string) => void;
  onClose: () => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  canSaveCurrent,
  onSaveSlot,
  onLoadSlot,
  onDeleteSlot,
  onClose,
}) => {
  const { locale, t, formatCurrency } = useLocalization();
  const [refreshTick, setRefreshTick] = useState(0);
  const [confirmOverwriteSlot, setConfirmOverwriteSlot] = useState<string | null>(null);
  const slots = listSaveSlots();
  void refreshTick;

  return (
    <ModalFrame
      title={t('saveLoad.title')}
      subtitle={t('saveLoad.subtitle')}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-3">
        {slots.map(({ slotId, meta }) => {
          const isAuto = slotId === 'autosave';
          const displayTitle = isAuto
            ? t('saveLoad.autosaveTitle')
            : t('saveLoad.slotTitle', { num: slotId.replace('slot_', '') });
          const confirmingOverwrite = confirmOverwriteSlot === slotId;

          return (
            <div
              key={slotId}
              className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[16px] text-[#303B38]">{displayTitle}</div>
                  {meta ? (
                    <div className="text-[14px] text-[#303B38]/85 mt-1 space-y-0.5">
                      <div>
                        {t('saveLoad.metaSummary', {
                          company: meta.companyName,
                          founder: meta.founderName,
                        })}
                      </div>
                      <div className="font-mono-num text-[13px] text-[#303B38]/80">
                        {t('saveLoad.metaDetails', {
                          year: meta.year,
                          month: meta.month,
                          day: meta.day,
                          cash: formatCurrency(meta.cash),
                          count: meta.employeesCount,
                          time: new Date(meta.savedAt).toLocaleTimeString(locale),
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[14px] text-[#303B38]/70 mt-1">{t('saveLoad.emptySlot')}</div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {canSaveCurrent && !isAuto && (
                    <button
                      type="button"
                      onClick={() => {
                        if (meta) {
                          setConfirmOverwriteSlot(slotId);
                          return;
                        }
                        onSaveSlot(slotId, displayTitle);
                        setConfirmOverwriteSlot(null);
                        setRefreshTick((tick) => tick + 1);
                      }}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[#303B38] font-bold text-[14px] cursor-pointer whitespace-normal text-center"
                    >
                      <Save className="w-4 h-4 shrink-0" />
                      <span>{t('common.save')}</span>
                    </button>
                  )}

                  {meta && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const ok = onLoadSlot(slotId);
                          if (ok) onClose();
                        }}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] font-bold text-[14px] cursor-pointer whitespace-normal text-center"
                      >
                        <FolderOpen className="w-4 h-4 shrink-0" />
                        <span>{t('common.load')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteSlot(slotId);
                          if (confirmOverwriteSlot === slotId) {
                            setConfirmOverwriteSlot(null);
                          }
                          setRefreshTick((tick) => tick + 1);
                        }}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#EAE5D8] hover:bg-[#303B38] hover:text-[#F3F0E7] border border-[#303B38]/30 text-[#303B38] cursor-pointer transition-colors"
                        title={t('saveLoad.deleteTitle')}
                        aria-label={`${t('common.delete')} ${displayTitle}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {confirmingOverwrite && meta && (
                <div className="bg-[#F3F0E7] border border-[#303B38] p-3 space-y-2.5">
                  <div className="text-[14px] font-bold text-[#303B38]">
                    {t('saveLoad.confirmOverwriteTitle', { slot: displayTitle })}
                  </div>
                  <p className="text-[13px] text-[#303B38]/85 leading-snug">
                    {t('saveLoad.confirmOverwriteBody', {
                      company: meta.companyName,
                      day: meta.day,
                    })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmOverwriteSlot(null)}
                      className="min-h-[40px] flex-1 min-w-[110px] px-3 py-1.5 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[13px] font-bold text-[#303B38] cursor-pointer"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSaveSlot(slotId, displayTitle);
                        setConfirmOverwriteSlot(null);
                        setRefreshTick((tick) => tick + 1);
                      }}
                      className="min-h-[40px] flex-1 min-w-[140px] px-3 py-1.5 bg-[#303B38] hover:bg-[#3F4D49] text-[#F3F0E7] text-[13px] font-bold cursor-pointer"
                    >
                      {t('saveLoad.confirmOverwriteBtn')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ModalFrame>
  );
};
