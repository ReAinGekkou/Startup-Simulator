import React from 'react';
import { Building2, Eye, Rocket, Sparkles, X } from 'lucide-react';
import { useLocalization } from '@/src/hooks/useLocalization';
import { getOfficeLevelLocalized, getRoomLocalized } from '@/src/localization';
import { GameState, MilestoneCelebration, RoomId } from '@/src/types/game';

interface MilestoneCelebrationBannerProps {
  celebration: MilestoneCelebration;
  state: GameState;
  hasOpenModal: boolean;
  onFocusRoom: (roomId: RoomId) => void;
  onWatchInOffice: (roomId: RoomId) => void;
  onDismiss: () => void;
}

export const MilestoneCelebrationBanner: React.FC<MilestoneCelebrationBannerProps> = ({
  celebration,
  state,
  hasOpenModal,
  onFocusRoom,
  onWatchInOffice,
  onDismiss,
}) => {
  const { locale, t } = useLocalization();

  const resolvedSubject = (() => {
    if (
      celebration.kind === 'HQ_EXPANSION' &&
      typeof celebration.detailValue === 'number' &&
      (celebration.detailValue === 2 ||
        celebration.detailValue === 3 ||
        celebration.detailValue === 4)
    ) {
      return getOfficeLevelLocalized(celebration.detailValue, locale).name;
    }
    if (celebration.kind === 'DEPARTMENT_EXPANSION') {
      const room = state.office.rooms[celebration.targetRoomId];
      return getRoomLocalized(celebration.targetRoomId, room?.unlockCost ?? 0, locale).name;
    }
    return celebration.subjectName;
  })();

  const title = t(`story.celebration.kinds.${celebration.kind}.title`, {
    subject: resolvedSubject,
    version: celebration.detailValue ?? 3,
    company: state.config.companyName,
  });

  const line = t(`story.celebration.kinds.${celebration.kind}.line`, {
    subject: resolvedSubject,
    count: celebration.detailValue ?? 0,
    version: celebration.detailValue ?? 3,
    company: state.config.companyName,
  });

  const isProduct =
    celebration.kind === 'PRODUCT_MVP_LAUNCH' ||
    celebration.kind === 'PRODUCT_MATURE_RELEASE';

  const Icon = isProduct ? Rocket : Building2;

  return (
    <div
      key={celebration.id}
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed left-1/2 -translate-x-1/2 md:left-[calc(50%+5.5rem)] z-40 w-[calc(100vw-1.5rem)] max-w-lg animate-celebration-in ${
        hasOpenModal ? 'bottom-3 sm:bottom-5' : 'bottom-28 md:bottom-[4.5rem]'
      }`}
    >
      <div className="pointer-events-auto relative overflow-hidden bg-[#FAF8F2]/96 border-2 border-[#303B38] shadow-[3px_3px_0_rgba(48,59,56,0.22)] text-[#303B38]">
        <div className="p-3 sm:p-3.5 flex items-start gap-3">
          {/* Pixel Icon Plaque */}
          <div className="relative w-11 h-11 shrink-0 bg-[#D9A66C]/35 border-2 border-[#303B38] flex items-center justify-center">
            <Icon className="w-5 h-5 text-[#303B38]" aria-hidden="true" />
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#78978A] border border-[#303B38]"
            />
          </div>

          {/* Celebration Title & Short Team Quote */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#5A786B]">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#D9A66C]" aria-hidden="true" />
              <span>{t('story.celebration.badge')}</span>
            </div>
            <div className="text-[15px] sm:text-[16px] font-bold text-[#303B38] leading-snug break-words">
              {title}
            </div>
            <p className="text-[13px] text-[#303B38]/85 leading-snug mt-0.5 break-words">
              {line}
            </p>
          </div>

          {/* Non-intrusive Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                hasOpenModal
                  ? onWatchInOffice(celebration.targetRoomId)
                  : onFocusRoom(celebration.targetRoomId)
              }
              className="min-h-[44px] px-2.5 py-1.5 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[12px] sm:text-[13px] font-bold text-[#303B38] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {hasOpenModal
                  ? t('story.celebration.watchTeam')
                  : t('story.celebration.focusRoom')}
              </span>
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t('story.celebration.dismiss')}
              title={t('story.celebration.dismiss')}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[#303B38] cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Auto-fade countdown ribbon (no inline style) */}
        <div
          aria-hidden="true"
          className="h-1 w-full bg-[#EAE5D8] border-t border-[#303B38]/15"
        >
          <div className="h-full w-full bg-[#78978A] animate-celebration-bar" />
        </div>
      </div>
    </div>
  );
};
