import React, { useEffect, useRef } from 'react';
import {
  BookOpen,
  Landmark,
  Package,
  Save,
  Settings,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useLocalization } from '@/src/hooks/useLocalization';
import { GameCommand, GameState, TutorialStepId } from '@/src/types/game';
import type { ActiveModal } from './GameHUD';

interface ManagementMenuProps {
  open: boolean;
  state: GameState;
  activeModal: ActiveModal;
  tutorialActive: boolean;
  recommendedTab?: 'OFFICE' | 'EMPLOYEES' | 'PRODUCTS' | 'FINANCE' | 'MARKET' | null;
  tutorialStep?: TutorialStepId | null;
  onClose: () => void;
  onOpenModal: (modal: ActiveModal) => void;
  onDispatch: (cmd: GameCommand) => void;
}

export const ManagementMenu: React.FC<ManagementMenuProps> = ({
  open,
  state,
  activeModal,
  tutorialActive,
  recommendedTab = null,
  onClose,
  onOpenModal,
  onDispatch,
}) => {
  const { t } = useLocalization();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-management-menu-trigger="true"]')) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const opsItems: Array<{
    id: 'EMPLOYEES' | 'PRODUCTS' | 'MARKET' | 'FINANCE' | 'OFFICE';
    targetId: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    onSelect: () => void;
  }> = [
    {
      id: 'EMPLOYEES',
      targetId: 'nav-employees',
      label: t('hud.nav.employees'),
      icon: Users,
      count: state.employees.length,
      onSelect: () => onOpenModal(activeModal === 'EMPLOYEES' ? null : 'EMPLOYEES'),
    },
    {
      id: 'PRODUCTS',
      targetId: 'nav-products',
      label: t('hud.nav.products'),
      icon: Package,
      count: state.products.length,
      onSelect: () => onOpenModal(activeModal === 'PRODUCTS' ? null : 'PRODUCTS'),
    },
    {
      id: 'MARKET',
      targetId: 'nav-market',
      label: t('hud.nav.market'),
      icon: TrendingUp,
      onSelect: () => onOpenModal(activeModal === 'MARKET' ? null : 'MARKET'),
    },
    {
      id: 'FINANCE',
      targetId: 'nav-finance',
      label: t('hud.nav.finance'),
      icon: Landmark,
      onSelect: () => {
        const opening = activeModal !== 'FINANCE';
        onOpenModal(opening ? 'FINANCE' : null);
        if (opening) {
          onDispatch({ type: 'REPORT_TUTORIAL_ACTION', action: 'REVIEW_FINANCE' });
        }
      },
    },
    {
      id: 'OFFICE',
      targetId: 'nav-office',
      label: t('hud.nav.upgrades'),
      icon: Sparkles,
      onSelect: () => onOpenModal(activeModal === 'OFFICE' ? null : 'OFFICE'),
    },
  ];

  const studioItems: Array<{
    id: 'MILESTONES' | 'SAVE_LOAD' | 'TUTORIAL' | 'SETTINGS';
    targetId: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
    onSelect: () => void;
  }> = [
    {
      id: 'MILESTONES',
      targetId: 'nav-milestones',
      label: t('hud.nav.milestones'),
      icon: Trophy,
      active: activeModal === 'MILESTONES',
      onSelect: () => onOpenModal(activeModal === 'MILESTONES' ? null : 'MILESTONES'),
    },
    {
      id: 'SAVE_LOAD',
      targetId: 'nav-save-load',
      label: t('hud.nav.saveLoad'),
      icon: Save,
      active: activeModal === 'SAVE_LOAD',
      onSelect: () => onOpenModal(activeModal === 'SAVE_LOAD' ? null : 'SAVE_LOAD'),
    },
    ...(!tutorialActive
      ? [
          {
            id: 'TUTORIAL' as const,
            targetId: 'nav-tutorial',
            label: t('hud.nav.tutorial'),
            icon: BookOpen,
            active: false,
            onSelect: () => onDispatch({ type: 'RESUME_TUTORIAL' }),
          },
        ]
      : []),
    {
      id: 'SETTINGS',
      targetId: 'nav-settings',
      label: t('hud.nav.settings'),
      icon: Settings,
      active: activeModal === 'SETTINGS',
      onSelect: () => onOpenModal(activeModal === 'SETTINGS' ? null : 'SETTINGS'),
    },
  ];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('hud.menuTitle')}
      className="pointer-events-auto w-[min(18.5rem,calc(100vw-24px))] max-h-[calc(100dvh-7.5rem)] overflow-y-auto bg-[#F3F0E7] border-2 border-[#303B38] shadow-[4px_4px_0px_rgba(48,59,56,0.22)] text-[#303B38]"
    >
      <div className="px-3.5 py-2.5 bg-[#FAF8F2] border-b border-[#303B38]/20 flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold tracking-tight text-[#303B38]">
          {t('hud.menuTitle')}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="min-w-[34px] min-h-[34px] flex items-center justify-center hover:bg-[#EAE5D8] border border-transparent hover:border-[#303B38]/20 cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-2.5 space-y-3">
        <div>
          <div className="px-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#303B38]/65">
            {t('hud.menuSectionOps')}
          </div>
          <div className="space-y-1">
            {opsItems.map((item) => {
              const Icon = item.icon;
              const isSelected = activeModal === item.id;
              const isTutTarget = recommendedTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-tutorial-target={item.targetId}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  className={`w-full min-h-[42px] flex items-center justify-between gap-2 px-3 py-2 text-[14px] font-bold cursor-pointer transition-colors border ${
                    isSelected
                      ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                      : isTutTarget
                        ? 'bg-[#FAF8F2] border-2 border-[#D9A66C] text-[#303B38] hover:bg-[#EAE5D8]'
                        : 'bg-[#FAF8F2] hover:bg-[#EAE5D8] border-[#303B38]/20 text-[#303B38]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && (
                    <span className="text-[12px] font-mono-num font-bold px-1.5 py-0.5 bg-[#F3F0E7] border border-[#303B38]/25 text-[#303B38]">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-[#303B38]/20">
          <div className="px-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#303B38]/65">
            {t('hud.menuSectionStudio')}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {studioItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-tutorial-target={item.targetId}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  className={`min-h-[40px] flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-bold cursor-pointer transition-colors border text-left ${
                    item.active
                      ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                      : 'bg-[#FAF8F2] hover:bg-[#EAE5D8] border-[#303B38]/20 text-[#303B38]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
