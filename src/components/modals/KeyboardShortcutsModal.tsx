import React from 'react';
import { Compass, Gauge, Keyboard, Layers, MousePointer } from 'lucide-react';
import { useLocalization } from '@/src/hooks/useLocalization';
import { ModalFrame } from './ModalFrame';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

interface ShortcutRow {
  keys: string[];
  description: string;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ onClose }) => {
  const { t } = useLocalization();

  const movementRows: ShortcutRow[] = [
    {
      keys: ['W', 'A', 'S', 'D'],
      description: t('shortcutsModal.moveWasdDesc'),
    },
    {
      keys: [t('shortcutsModal.keyArrows')],
      description: t('shortcutsModal.moveArrowsDesc'),
    },
  ];

  const speedRows: ShortcutRow[] = [
    {
      keys: [t('shortcutsModal.keySpace')],
      description: t('shortcutsModal.pauseResumeDesc'),
    },
    {
      keys: ['1'],
      description: t('shortcutsModal.speed1Desc'),
    },
    {
      keys: ['2'],
      description: t('shortcutsModal.speed2Desc'),
    },
    {
      keys: ['3'],
      description: t('shortcutsModal.speed3Desc'),
    },
  ];

  const interfaceRows: ShortcutRow[] = [
    {
      keys: [t('shortcutsModal.keyM')],
      description: t('shortcutsModal.muteAudioDesc'),
    },
    {
      keys: [t('shortcutsModal.keyEsc')],
      description: t('shortcutsModal.escDesc'),
    },
  ];

  const mouseRows: ShortcutRow[] = [
    {
      keys: [t('shortcutsModal.keyLeftClick')],
      description: t('shortcutsModal.mouseWalkDesc'),
    },
    {
      keys: [t('shortcutsModal.keyLeftClick')],
      description: t('shortcutsModal.mouseInspectDesc'),
    },
    {
      keys: [t('shortcutsModal.keyDragWheel')],
      description: t('shortcutsModal.mouseCameraDesc'),
    },
  ];

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    rows: ShortcutRow[]
  ) => (
    <section className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 space-y-2.5">
      <h3 className="flex items-center gap-2 text-[20px] font-bold text-[#303B38]">
        {icon}
        <span>{title}</span>
      </h3>
      <div className="divide-y divide-[#303B38]/15">
        {rows.map((row, idx) => (
          <div
            key={`${title}-${idx}`}
            className="py-2.5 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4"
          >
            <span className="text-[15px] text-[#303B38] leading-snug">{row.description}</span>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {row.keys.map((keyLabel, kIdx) => (
                <kbd
                  key={`${keyLabel}-${kIdx}`}
                  className="inline-flex items-center justify-center min-w-[34px] px-2.5 py-1 bg-[#F3F0E7] border border-[#303B38]/45 border-b-2 text-[14px] font-bold text-[#303B38] leading-none"
                >
                  {keyLabel}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <ModalFrame
      title={t('shortcutsModal.title')}
      subtitle={t('shortcutsModal.subtitle')}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {renderSection(
          t('shortcutsModal.movementSection'),
          <Compass className="w-5 h-5 text-[#303B38]" aria-hidden="true" />,
          movementRows
        )}

        {renderSection(
          t('shortcutsModal.speedSection'),
          <Gauge className="w-5 h-5 text-[#303B38]" aria-hidden="true" />,
          speedRows
        )}

        {renderSection(
          t('shortcutsModal.interfaceSection'),
          <Layers className="w-5 h-5 text-[#303B38]" aria-hidden="true" />,
          interfaceRows
        )}

        {renderSection(
          t('shortcutsModal.mouseSection'),
          <MousePointer className="w-5 h-5 text-[#303B38]" aria-hidden="true" />,
          mouseRows
        )}

        <div className="bg-[#EAE5D8] border border-[#303B38]/25 p-3.5 flex items-start gap-2.5 text-[14px] text-[#303B38]">
          <Keyboard className="w-4 h-4 text-[#303B38] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-snug">{t('shortcutsModal.noteText')}</p>
        </div>

        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-6 py-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] text-[15px] font-bold cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};
