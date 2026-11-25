import React from 'react';
import {
  Briefcase,
  Building2,
  Check,
  Coffee,
  Footprints,
  Landmark,
  Laptop,
  MapPin,
  MessageCircle,
  Mic,
  RefreshCw,
  Store,
  UserPlus,
  X,
} from 'lucide-react';
import { WORLD_LOCATIONS } from '@/src/game/data/cityWorld';
import { useLocalization } from '@/src/hooks/useLocalization';
import { getRoleLocalized } from '@/src/localization/i18n';
import { GameCommand, GameState, WorldLocationId } from '@/src/types/game';
import { ActiveModal } from './GameHUD';
import { PixelAvatar } from './PixelAvatar';

interface WorldActionDrawerProps {
  state: GameState;
  selectedLocationId: WorldLocationId | null;
  selectedWorldNpcId: string | null;
  onClose: () => void;
  onDispatch: (cmd: GameCommand) => void;
  onOpenModal: (modal: ActiveModal) => void;
  onWalkToLocation?: (locationId: WorldLocationId) => void;
}

const LOCATION_ICONS: Record<
  WorldLocationId,
  React.ComponentType<{ className?: string }>
> = {
  COMPANY_HQ: Building2,
  MAIN_STREET: MapPin,
  COFFEE_SHOP: Coffee,
  COWORKING_SPACE: Laptop,
  INVESTOR_CENTER: Landmark,
  EVENT_HALL: Mic,
  BUSINESS_PROPERTIES: Store,
};

export const WorldActionDrawer: React.FC<WorldActionDrawerProps> = ({
  state,
  selectedLocationId,
  selectedWorldNpcId,
  onClose,
  onDispatch,
  onOpenModal,
  onWalkToLocation,
}) => {
  const { locale, t, formatCurrency } = useLocalization();
  const world = state.world;
  if (!world) return null;

  const npc = selectedWorldNpcId
    ? world.npcs.find((n) => n.id === selectedWorldNpcId) ?? null
    : null;
  const effectiveLocationId: WorldLocationId | null =
    npc?.locationId ?? selectedLocationId;

  if (!npc && !effectiveLocationId) return null;
  if (!npc && effectiveLocationId === 'COMPANY_HQ') return null;

  const locId = effectiveLocationId ?? 'MAIN_STREET';
  const LocIcon = LOCATION_ICONS[locId];
  const locMeta = WORLD_LOCATIONS[locId];
  const locationNpcs = world.npcs.filter((n) => n.locationId === locId);
  const linkedCandidate = npc?.linkedCandidateId
    ? state.candidates.find((c) => c.id === npc.linkedCandidateId) ?? null
    : null;
  const interactedToday = Boolean(
    npc && npc.lastInteractedDay === state.totalDays && npc.kind !== 'CANDIDATE'
  );

  const headerTitle = npc ? npc.name : t(`world.locations.${locId}.name`);
  const headerSubtitle = npc
    ? `${npc.roleTitle} · ${t(`world.locations.${locId}.shortName`)}`
    : t('world.drawer.districtLabel');

  return (
    <aside
      aria-label={headerTitle}
      className="fixed inset-x-2 bottom-2 max-h-[60dvh] md:inset-x-auto md:right-3 md:top-[4.75rem] md:bottom-20 md:max-h-none md:w-[22rem] z-20 bg-[#F3F0E7] border-2 border-[#303B38] shadow-[4px_4px_0px_rgba(48,59,56,0.22)] flex flex-col overflow-hidden text-[#303B38]"
    >
      <div className="md:hidden flex justify-center pt-1.5 bg-[#FAF8F2]" aria-hidden="true">
        <span className="w-10 h-1 bg-[#303B38]/25" />
      </div>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#303B38]/20 bg-[#FAF8F2]">
        <div className="flex items-center gap-3 min-w-0">
          {npc ? (
            <PixelAvatar
              appearance={npc.appearance}
              size={48}
              moodTone="HAPPY"
              status="IDLE"
            />
          ) : (
            <div className="w-11 h-11 flex items-center justify-center bg-[#78978A]/35 border border-[#303B38] shrink-0">
              <LocIcon className="w-5 h-5 text-[#303B38]" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold text-[#303B38] truncate">{headerTitle}</h2>
            <p className="text-[13px] text-[#303B38]/80 truncate">{headerSubtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/25 text-[#303B38] cursor-pointer shrink-0"
          aria-label={t('world.drawer.closeAria')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-[14px]">
        {npc ? (
          <>
            <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-3 flex items-center justify-between gap-2">
              <span className="text-[#303B38]/80">{npc.roleTitle}</span>
              <span className="px-2 py-0.5 bg-[#D9A66C]/30 border border-[#303B38]/30 text-[12px] font-bold">
                {t(`world.npcKinds.${npc.kind}`)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() =>
                  onDispatch({
                    type: 'MOVE_FOUNDER',
                    target: npc.position,
                  })
                }
                className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/35 px-3 py-2 font-bold text-[#303B38] cursor-pointer"
              >
                <Footprints className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('world.drawer.walkHereBtn')}</span>
              </button>

              <button
                type="button"
                disabled={interactedToday}
                onClick={() =>
                  onDispatch({
                    type: 'WORLD_INTERACT_NPC',
                    npcId: npc.id,
                  })
                }
                className={`w-full min-h-[44px] flex items-center justify-center gap-2 border px-3 py-2 font-bold ${
                  interactedToday
                    ? 'bg-[#EAE5D8] border-[#303B38]/25 text-[#303B38]/55 cursor-not-allowed'
                    : 'bg-[#78978A] hover:bg-[#6A897C] border-[#303B38] text-[#303B38] cursor-pointer'
                }`}
              >
                <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {interactedToday
                    ? t('world.drawer.npcTalkedToday')
                    : t('world.drawer.npcTalkBtn')}
                </span>
              </button>

              {linkedCandidate && (
                <button
                  type="button"
                  onClick={() =>
                    onDispatch({
                      type: 'HIRE_CANDIDATE',
                      candidateId: linkedCandidate.id,
                    })
                  }
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#D9A66C] hover:bg-[#CCA05F] border border-[#303B38] px-3 py-2 font-bold text-[#303B38] cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {t('world.drawer.npcHireNowBtn', {
                      fee: formatCurrency(linkedCandidate.hiringFee),
                    })}
                  </span>
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-[14px] text-[#303B38] leading-relaxed">
              {t(`world.locations.${locId}.description`)}
            </p>

            <button
              type="button"
              onClick={() => {
                onDispatch({ type: 'MOVE_FOUNDER', target: locMeta.entranceTile });
                onWalkToLocation?.(locId);
              }}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/35 px-3 py-2 font-bold text-[#303B38] cursor-pointer"
            >
              <Footprints className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t('world.drawer.walkHereBtn')}</span>
            </button>

            {locId === 'COFFEE_SHOP' && (
              <div className="pt-3 border-t border-[#303B38]/20 space-y-2.5">
                <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-3 flex items-center justify-between">
                  <span className="text-[#303B38]/80">{t('world.drawer.coffeeVisitsLabel')}</span>
                  <span className="font-mono-num font-bold">{world.coffeeVisitsToday}/2</span>
                </div>
                <button
                  type="button"
                  disabled={world.coffeeVisitsToday >= 2}
                  onClick={() => onDispatch({ type: 'WORLD_COFFEE_BREAK' })}
                  className={`w-full min-h-[44px] flex items-center justify-center gap-2 border px-3 py-2 font-bold ${
                    world.coffeeVisitsToday >= 2
                      ? 'bg-[#EAE5D8] border-[#303B38]/25 text-[#303B38]/55 cursor-not-allowed'
                      : 'bg-[#78978A] hover:bg-[#6A897C] border-[#303B38] text-[#303B38] cursor-pointer'
                  }`}
                >
                  <Coffee className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{t('world.drawer.buyCoffeeBtn', { cost: formatCurrency(18) })}</span>
                </button>
              </div>
            )}

            {locId === 'COWORKING_SPACE' && (
              <div className="pt-3 border-t border-[#303B38]/20 space-y-2.5">
                <div className="text-[13px] font-bold text-[#303B38]">
                  {t('world.drawer.coworkingTitle')}
                </div>
                {state.candidates.length === 0 ? (
                  <p className="text-[13px] text-[#303B38]/75 bg-[#FAF8F2] border border-[#303B38]/20 p-3">
                    {t('world.drawer.noCandidatesHint')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {state.candidates.slice(0, 2).map((cand) => {
                      const roleInfo = getRoleLocalized(cand.role, locale);
                      return (
                        <div
                          key={cand.id}
                          className="bg-[#FAF8F2] border border-[#303B38]/25 p-3 space-y-2"
                        >
                          <div className="flex items-center gap-2.5">
                            <PixelAvatar appearance={cand.appearance} size={36} status="IDLE" />
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-[#303B38] truncate">{cand.name}</div>
                              <div className="text-[12px] text-[#303B38]/75 truncate">
                                {roleInfo.label} · {formatCurrency(cand.expectedSalary)}
                                {t('common.perMonth')}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onDispatch({ type: 'HIRE_CANDIDATE', candidateId: cand.id })
                            }
                            className="w-full min-h-[40px] flex items-center justify-center gap-1.5 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] px-3 py-1.5 text-[13px] font-bold text-[#303B38] cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              {t('world.drawer.npcHireNowBtn', {
                                fee: formatCurrency(cand.hiringFee),
                              })}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onDispatch({ type: 'REFRESH_CANDIDATES' })}
                  className="w-full min-h-[42px] flex items-center justify-center gap-2 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/30 px-3 py-2 font-bold text-[#303B38] cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {t('world.drawer.refreshSearchBtn', { cost: formatCurrency(150) })}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModal('EMPLOYEES')}
                  className="w-full min-h-[42px] bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/30 px-3 py-2 font-bold text-[#303B38] cursor-pointer"
                >
                  {t('world.drawer.openHrBtn')}
                </button>
              </div>
            )}

            {locId === 'INVESTOR_CENTER' && (
              <div className="pt-3 border-t border-[#303B38]/20 space-y-2.5">
                <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-3 space-y-1.5 text-[13px] font-mono-num">
                  <div className="flex justify-between">
                    <span className="text-[#303B38]/80">{t('world.drawer.investorTrustLabel')}</span>
                    <span className="font-bold">{Math.round(state.founder.investorTrust)}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#303B38]/80">
                      {t('world.drawer.investorReputationLabel')}
                    </span>
                    <span className="font-bold">{Math.round(state.founder.reputation)}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#303B38]/80">{t('world.drawer.investorPitchedToday')}</span>
                    <span className="font-bold">{world.investorPitchesToday}/1</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={world.investorPitchesToday >= 1}
                  onClick={() => onDispatch({ type: 'WORLD_PITCH_INVESTOR' })}
                  className={`w-full min-h-[44px] flex items-center justify-center gap-2 border px-3 py-2 font-bold ${
                    world.investorPitchesToday >= 1
                      ? 'bg-[#EAE5D8] border-[#303B38]/25 text-[#303B38]/55 cursor-not-allowed'
                      : 'bg-[#78978A] hover:bg-[#6A897C] border-[#303B38] text-[#303B38] cursor-pointer'
                  }`}
                >
                  <Briefcase className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{t('world.drawer.pitchInvestorBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModal('FINANCE')}
                  className="w-full min-h-[42px] bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/30 px-3 py-2 font-bold text-[#303B38] cursor-pointer"
                >
                  {t('world.drawer.openFinanceBtn')}
                </button>
              </div>
            )}

            {locId === 'EVENT_HALL' && (
              <div className="pt-3 border-t border-[#303B38]/20 space-y-2.5">
                <div className="bg-[#FAF8F2] border border-[#303B38]/20 p-3 flex items-center justify-between">
                  <span className="text-[#303B38]/80">{t('world.drawer.eventsAttendedLabel')}</span>
                  <span className="font-mono-num font-bold">{world.eventsAttendedTotal}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onDispatch({ type: 'WORLD_HOST_EVENT' })}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] px-3 py-2 font-bold text-[#303B38] cursor-pointer"
                >
                  <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{t('world.drawer.hostEventBtn', { cost: formatCurrency(650) })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModal('MARKET')}
                  className="w-full min-h-[42px] bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/30 px-3 py-2 font-bold text-[#303B38] cursor-pointer"
                >
                  {t('world.drawer.openMarketBtn')}
                </button>
              </div>
            )}

            {locId === 'BUSINESS_PROPERTIES' && (
              <div className="pt-3 border-t border-[#303B38]/20 space-y-2.5">
                {world.properties.map((prop) => (
                  <div
                    key={prop.id}
                    className={`border p-3 space-y-2 ${
                      prop.owned
                        ? 'bg-[#DCE7E1]/60 border-[#303B38]'
                        : 'bg-[#FAF8F2] border-[#303B38]/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[#303B38]">
                          {t(`world.properties.${prop.id}.name`)}
                        </div>
                        <p className="text-[12px] text-[#303B38]/80 leading-snug mt-0.5">
                          {t(`world.properties.${prop.id}.description`)}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 border text-[11px] font-bold shrink-0 ${
                          prop.owned
                            ? 'bg-[#78978A] border-[#303B38] text-[#303B38]'
                            : 'bg-[#EAE5D8] border-[#303B38]/25 text-[#303B38]'
                        }`}
                      >
                        {prop.owned ? t('world.drawer.ownedBadge') : t('world.drawer.availableBadge')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[12px] font-mono-num bg-[#F3F0E7] border border-[#303B38]/15 p-2">
                      <div>
                        <div className="text-[11px] text-[#303B38]/70">
                          {t('world.drawer.monthlyRevLabel')}
                        </div>
                        <div className="font-bold">+{formatCurrency(prop.monthlyRevenue)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#303B38]/70">
                          {t('world.drawer.capacityBonusLabel')}
                        </div>
                        <div className="font-bold">+{prop.teamCapacityBonus}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#303B38]/70">
                          {t('world.drawer.repBonusLabel')}
                        </div>
                        <div className="font-bold">+{prop.reputationBonus}</div>
                      </div>
                    </div>

                    {prop.owned ? (
                      <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#303B38]">
                        <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>
                          {t('world.drawer.purchasedOnDay', {
                            day: prop.purchasedDay ?? state.totalDays,
                          })}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onDispatch({ type: 'WORLD_BUY_PROPERTY', propertyId: prop.id })
                        }
                        className="w-full min-h-[42px] bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] px-3 py-1.5 text-[13px] font-bold text-[#303B38] cursor-pointer"
                      >
                        {t('world.drawer.buyPropertyBtn', { cost: formatCurrency(prop.cost) })}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {locId === 'MAIN_STREET' && (
              <div className="pt-3 border-t border-[#303B38]/20 space-y-2">
                <p className="text-[13px] text-[#303B38]/85 bg-[#D9A66C]/20 border border-[#303B38]/25 p-2.5">
                  {t('world.drawer.billboardHint', { company: state.config.companyName })}
                </p>
              </div>
            )}
          </>
        )}

        {locationNpcs.length > 0 && (
          <div className="pt-3 border-t border-[#303B38]/20 space-y-2">
            <div className="text-[13px] font-bold text-[#303B38]">
              {npc ? t('world.drawer.mainStreetContactsTitle') : t('world.drawer.npcSectionTitle')}
            </div>
            <div className="space-y-1.5">
              {locationNpcs.map((person) => {
                const doneToday =
                  person.lastInteractedDay === state.totalDays && person.kind !== 'CANDIDATE';
                return (
                  <div
                    key={person.id}
                    className="bg-[#FAF8F2] border border-[#303B38]/20 px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PixelAvatar appearance={person.appearance} size={32} status="IDLE" />
                      <div className="min-w-0">
                        <div className="font-bold text-[13px] truncate">{person.name}</div>
                        <div className="text-[12px] text-[#303B38]/75 truncate">
                          {person.roleTitle}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={doneToday}
                      onClick={() => onDispatch({ type: 'WORLD_INTERACT_NPC', npcId: person.id })}
                      className={`min-h-[40px] px-2.5 border text-[12px] font-bold shrink-0 ${
                        doneToday
                          ? 'bg-[#EAE5D8] border-[#303B38]/20 text-[#303B38]/55 cursor-not-allowed'
                          : 'bg-[#78978A] hover:bg-[#6A897C] border-[#303B38] text-[#303B38] cursor-pointer'
                      }`}
                    >
                      {t(`world.npcKinds.${person.kind}`)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
