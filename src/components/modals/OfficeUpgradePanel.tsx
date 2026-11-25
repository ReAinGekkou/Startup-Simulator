import React from 'react';
import { Building2, Check, ChevronDown, Coffee, Cpu, DoorOpen, Lock, Move, ShoppingBag } from 'lucide-react';
import {
  FURNITURE_CATALOG,
  OFFICE_LEVELS,
  OFFICE_PERKS,
  getOfficePerkBonuses,
} from '@/src/game/data/officeLayout';
import { useLocalization } from '@/src/hooks/useLocalization';
import {
  getFurnitureLocalized,
  getOfficeLevelLocalized,
  getPerkLocalized,
  getRoomLocalized,
} from '@/src/localization/i18n';
import { GameCommand, GameState, RoomId } from '@/src/types/game';
import { ModalFrame } from './ModalFrame';

interface OfficeUpgradePanelProps {
  state: GameState;
  onDispatch: (cmd: GameCommand) => void;
  onStartPlaceTemplate: (templateId: string) => void;
  onStartMoveFurniture: (furnitureId: string) => void;
  onClose: () => void;
}

const ROOM_ORDER: RoomId[] = [
  'CEO_OFFICE',
  'ENGINEERING',
  'HR_DEPT',
  'FINANCE_DEPT',
  'BREAK_ROOM',
  'MEETING_ROOM',
  'LOBBY',
  'LEGAL_DEPT',
];

export const OfficeUpgradePanel: React.FC<OfficeUpgradePanelProps> = ({
  state,
  onDispatch,
  onStartPlaceTemplate,
  onStartMoveFurniture,
  onClose,
}) => {
  const { locale, t, formatCurrency } = useLocalization();
  const currentOfficeLoc = getOfficeLevelLocalized(state.office.level, locale);
  const nextLevel = state.office.level < 4 ? ((state.office.level + 1) as 2 | 3 | 4) : null;
  const nextSpec = nextLevel ? OFFICE_LEVELS[nextLevel] : null;
  const nextSpecLoc = nextLevel ? getOfficeLevelLocalized(nextLevel, locale) : null;
  const techCost = state.office.techTier * 3500;
  const ownedPerks = new Set(state.office.purchasedPerks ?? []);
  const perkBonuses = getOfficePerkBonuses(state.office);

  return (
    <ModalFrame
      title={t('office.title')}
      subtitle={t('office.subtitle', {
        name: currentOfficeLoc.name,
        comfort: state.office.comfortScore,
        tech: state.office.techTier,
      })}
      onClose={onClose}
    >
      <div className="space-y-6">
        {/* HQ Expansion & Workstation Tech */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-[18px] text-[#303B38]">
                <Building2 className="w-5 h-5" />
                {t('office.hqExpansion', { level: state.office.level })}
              </div>
              {nextSpec && nextSpecLoc ? (
                <p className="text-[15px] text-[#303B38]/85 mt-2 leading-relaxed">
                  {t('office.nextLabel')}{' '}
                  {t('office.hqNextDesc', {
                    name: nextSpecLoc.name,
                    desc: nextSpecLoc.description,
                    maxEmp: nextSpec.maxEmployees,
                    rent: formatCurrency(nextSpec.monthlyRent),
                  })}
                </p>
              ) : (
                <p className="text-[15px] font-bold text-[#303B38] mt-2">
                  {t('office.hqMaxed')}
                </p>
              )}
            </div>
            {nextSpec && (
              <button
                type="button"
                onClick={() => onDispatch({ type: 'EXPAND_OFFICE' })}
                className="min-h-[44px] w-full py-2.5 px-4 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[#303B38] font-bold text-[14px] cursor-pointer"
              >
                {t('office.expandHqBtn', { cost: formatCurrency(nextSpec.upgradeCost) })}
              </button>
            )}
          </div>

          <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-[18px] text-[#303B38]">
                <Cpu className="w-5 h-5" />
                {t('office.workstationTech', { tier: state.office.techTier })}
              </div>
              <p className="text-[15px] text-[#303B38]/85 mt-2 leading-relaxed">
                {t('office.workstationDesc')}
              </p>
            </div>
            <button
              type="button"
              disabled={state.office.techTier >= 4}
              onClick={() => onDispatch({ type: 'UPGRADE_WORKSTATIONS' })}
              className="min-h-[44px] w-full py-2.5 px-4 bg-[#F3F0E7] hover:bg-[#EAE5D8] disabled:opacity-45 border border-[#303B38]/35 text-[#303B38] font-bold text-[14px] cursor-pointer"
            >
              {state.office.techTier >= 4
                ? t('office.hardwareMaxed')
                : t('office.upgradeHardwareBtn', { cost: formatCurrency(techCost) })}
            </button>
          </div>
        </div>

        {/* Progressive Department Unlocks */}
        <section className="border-t border-[#303B38]/20 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-bold text-[20px] text-[#303B38] flex items-center gap-2">
              <DoorOpen className="w-5 h-5" />
              {t('rooms.unlockedCount', {
                unlocked: ROOM_ORDER.filter((id) => state.office.rooms[id]?.unlocked).length,
                total: ROOM_ORDER.length,
              })}
            </h3>
            <span className="text-[13px] text-[#303B38]/80">{t('rooms.unlockHint')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {ROOM_ORDER.map((id) => {
              const room = state.office.rooms[id];
              if (!room) return null;
              const locRoom = getRoomLocalized(id, room.unlockCost, locale);
              return (
                <div
                  key={id}
                  className={`border p-3 flex flex-col justify-between gap-2 ${
                    room.unlocked
                      ? 'bg-[#78978A]/18 border-[#303B38]/35'
                      : 'bg-[#FAF8F2] border-[#303B38]/25'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[15px] text-[#303B38]">{locRoom.name}</span>
                      {room.unlocked ? (
                        <Check className="w-4 h-4 text-[#303B38] shrink-0" />
                      ) : (
                        <Lock className="w-4 h-4 text-[#303B38]/70 shrink-0" />
                      )}
                    </div>
                    <p className="text-[13px] text-[#303B38]/80 mt-1 leading-snug">
                      {room.unlocked ? locRoom.description : locRoom.unlockCondition}
                    </p>
                  </div>

                  {room.unlocked ? (
                    <div className="text-[13px] font-bold text-[#303B38] pt-1">
                      {t('rooms.activeDept')}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDispatch({ type: 'UNLOCK_ROOM', roomId: id })}
                      className="min-h-[40px] w-full py-1.5 px-2.5 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[13px] font-bold text-[#303B38] cursor-pointer"
                    >
                      {t('rooms.unlockEarly', { cost: formatCurrency(room.unlockCost) })}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Office Perks & Passive Amenities (Progressive Disclosure) */}
        <details className="bg-[#FAF8F2] border border-[#303B38]/25 p-4">
          <summary className="min-h-[44px] cursor-pointer select-none flex flex-wrap items-center justify-between gap-2 list-none">
            <span className="font-bold text-[18px] text-[#303B38] flex items-center gap-2">
              <Coffee className="w-5 h-5 shrink-0" aria-hidden="true" />
              {t('office.perksTitle', { owned: ownedPerks.size, total: OFFICE_PERKS.length })}
            </span>
            <span className="inline-flex items-center gap-2 text-[13px] font-mono-num text-[#303B38]/85">
              <span>
                {t('office.perksDailyBuff', {
                  morale: perkBonuses.moraleBonusPerDay.toFixed(1),
                  energy: perkBonuses.energyRecoveryPerDay,
                  stress: perkBonuses.stressReductionPerDay.toFixed(1),
                })}
              </span>
              <ChevronDown className="w-4 h-4 text-[#303B38]/75 shrink-0" aria-hidden="true" />
            </span>
          </summary>

          <div className="mt-3 pt-3 border-t border-[#303B38]/15 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {OFFICE_PERKS.map((perk) => {
              const owned = ownedPerks.has(perk.id);
              const lockedByHq = state.office.level < perk.minOfficeLevel;
              const locPerk = getPerkLocalized(perk.id, locale);

              return (
                <div
                  key={perk.id}
                  className={`border p-3.5 flex flex-col justify-between gap-2.5 ${
                    owned
                      ? 'bg-[#78978A]/20 border-[#303B38]'
                      : 'bg-[#FAF8F2] border-[#303B38]/25'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-[15px] text-[#303B38]">{locPerk.name}</span>
                      {owned ? (
                        <span className="font-mono-num text-[13px] border border-[#303B38] bg-[#78978A] text-[#303B38] px-2 py-0.5 font-bold shrink-0">
                          {t('office.activeBadge')}
                        </span>
                      ) : (
                        <span className="font-mono-num text-[13px] font-bold text-[#303B38] shrink-0">
                          {formatCurrency(perk.cost)}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-[#303B38]/85 mt-1">{locPerk.description}</p>
                    <div className="text-[13px] font-mono-num text-[#303B38] mt-1.5">
                      {t('office.perkStats', {
                        morale: perk.moraleBonusPerDay,
                        energy: perk.energyRecoveryPerDay,
                        stress: perk.stressReductionPerDay,
                      })}
                    </div>
                    <div className="text-[13px] font-mono-num text-[#303B38]/80 mt-0.5">
                      {t('office.perkComfort', { comfort: perk.comfortBonus })}
                      {perk.minOfficeLevel > 1
                        ? t('office.perkReqHq', { lvl: perk.minOfficeLevel })
                        : ''}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={owned || lockedByHq}
                    onClick={() => onDispatch({ type: 'BUY_OFFICE_PERK', perkId: perk.id })}
                    className={`min-h-[44px] w-full py-2 px-3 text-[14px] font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                      owned
                        ? 'bg-[#EAE5D8] border-[#303B38]/30 text-[#303B38] cursor-default'
                        : lockedByHq
                          ? 'bg-[#EAE5D8] border-[#303B38]/20 text-[#303B38]/60 cursor-not-allowed'
                          : 'bg-[#78978A] hover:bg-[#6A897C] border-[#303B38] text-[#303B38] cursor-pointer'
                    }`}
                  >
                    {owned ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t('office.installedBtn')}
                      </>
                    ) : lockedByHq ? (
                      <>
                        <Lock className="w-4 h-4" />
                        {t('office.reqHqBtn', { lvl: perk.minOfficeLevel })}
                      </>
                    ) : (
                      t('office.purchasePerkBtn', { cost: formatCurrency(perk.cost) })
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </details>

        {/* Buy Furniture (Progressive Disclosure) */}
        <details className="bg-[#FAF8F2] border border-[#303B38]/25 p-4">
          <summary className="min-h-[44px] cursor-pointer select-none flex items-center justify-between gap-2 list-none">
            <span className="font-bold text-[18px] text-[#303B38] flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 shrink-0" aria-hidden="true" />
              {t('office.buyFurnitureTitle')}
            </span>
            <ChevronDown className="w-4 h-4 text-[#303B38]/75 shrink-0" aria-hidden="true" />
          </summary>
          <div className="mt-3 pt-3 border-t border-[#303B38]/15 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FURNITURE_CATALOG.map((item) => {
              const locItem = getFurnitureLocalized(
                item.templateId,
                item.name,
                item.description,
                locale
              );
              return (
                <div
                  key={item.templateId}
                  className="bg-[#FAF8F2] border border-[#303B38]/25 p-3.5 flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-[15px] text-[#303B38]">{locItem.name}</span>
                      <span className="font-mono-num text-[13px] font-bold text-[#303B38]">
                        {formatCurrency(item.cost)}
                      </span>
                    </div>
                    <p className="text-[14px] text-[#303B38]/85 mt-1">{locItem.description}</p>
                    <div className="text-[13px] font-mono-num text-[#303B38] mt-1.5">
                      {t('office.furnStats', {
                        comfort: item.comfortBonus,
                        prod: item.productivityBonus,
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onStartPlaceTemplate(item.templateId);
                      onClose();
                    }}
                    className="min-h-[44px] w-full py-2 bg-[#F3F0E7] hover:bg-[#78978A] border border-[#303B38] text-[14px] font-bold text-[#303B38] transition-colors cursor-pointer"
                  >
                    {t('office.buyPlaceBtn')}
                  </button>
                </div>
              );
            })}
          </div>
        </details>

        {/* Move Existing Furniture (Progressive Disclosure) */}
        <details className="bg-[#FAF8F2] border border-[#303B38]/25 p-4">
          <summary className="min-h-[44px] cursor-pointer select-none flex items-center justify-between gap-2 list-none">
            <span className="font-bold text-[18px] text-[#303B38] flex items-center gap-2">
              <Move className="w-5 h-5 shrink-0" aria-hidden="true" />
              {t('office.relocateTitle', { count: state.office.furniture.length })}
            </span>
            <ChevronDown className="w-4 h-4 text-[#303B38]/75 shrink-0" aria-hidden="true" />
          </summary>
          <div className="mt-3 pt-3 border-t border-[#303B38]/15 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {state.office.furniture.map((f) => {
              const locFurn = getFurnitureLocalized(f.templateId, f.name, '', locale);
              const locRoom = getRoomLocalized(f.roomId, 0, locale);
              return (
                <div
                  key={f.id}
                  className="bg-[#FAF8F2] border border-[#303B38]/25 px-3 py-2.5 flex items-center justify-between gap-2 text-[14px]"
                >
                  <div className="truncate">
                    <div className="text-[#303B38] font-bold truncate">{locFurn.name}</div>
                    <div className="text-[13px] text-[#303B38]/75">{locRoom.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onStartMoveFurniture(f.id);
                      onClose();
                    }}
                    className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 bg-[#EAE5D8] hover:bg-[#78978A] border border-[#303B38]/30 text-[13px] font-bold text-[#303B38] cursor-pointer shrink-0"
                  >
                    <Move className="w-3.5 h-3.5" />
                    {t('office.moveBtn')}
                  </button>
                </div>
              );
            })}
          </div>
        </details>
      </div>
    </ModalFrame>
  );
};
