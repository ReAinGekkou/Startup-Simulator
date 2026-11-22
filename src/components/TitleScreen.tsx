import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  ChevronRight,
  Film,
  FolderOpen,
  LogIn,
  LogOut,
  Play,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Square,
  User,
  UserPlus,
  Volume2,
} from 'lucide-react';
import { getMainMenuIntroScript } from '@/src/audio/voiceRegistry';
import { DEFAULT_NEW_GAME_PARAMS } from '@/src/game/engine/initGame';
import { useAuth } from '@/src/hooks/useAuth';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useVoiceOver } from '@/src/hooks/useVoiceOver';
import {
  BusinessType,
  DifficultyLevel,
  GameMode,
  NewGameParams,
  SaveSlotMeta,
} from '@/src/types/game';
import { LanguageSelector } from './LanguageSelector';
import { AuthModal, AuthModalMode } from './modals/AuthModal';
import { SettingsModal } from './modals/SettingsModal';
import { PixelAvatar } from './PixelAvatar';
import { TitleDustOverlay } from './TitleDustOverlay';

interface TitleScreenProps {
  hasSave: boolean;
  latestSaveMeta: SaveSlotMeta | null;
  onStartGame: (params: NewGameParams) => void;
  onContinueGame: () => void;
  onOpenSaveLoad: () => void;
  onOpenEndingGallery: () => void;
  onWatchIntro: () => void;
}

const BUSINESS_TYPES: BusinessType[] = [
  'SAAS',
  'MOBILE_APP',
  'GAME_STUDIO',
  'AI_TOOLS',
  'WEB_PLATFORM',
];

const DIFFICULTY_LEVELS: Array<{ value: DifficultyLevel; cash: number }> = [
  { value: 'BOOTSTRAPPED', cash: 28000 },
  { value: 'BALANCED', cash: 42000 },
  { value: 'ANGEL_BACKED', cash: 68000 },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSave,
  latestSaveMeta,
  onStartGame,
  onContinueGame,
  onOpenSaveLoad,
  onOpenEndingGallery,
  onWatchIntro,
}) => {
  const { locale, t, formatCurrency } = useLocalization();
  const { user, sessionExpiredNotice, clearExpiredNotice, logout } = useAuth();
  const { speak, stop, isSpeaking } = useVoiceOver();

  const [showCustom, setShowCustom] = useState(false);
  const [params, setParams] = useState<NewGameParams>(DEFAULT_NEW_GAME_PARAMS);
  const [pendingNewParams, setPendingNewParams] = useState<NewGameParams | null>(null);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const handleToggleIntroVoice = () => {
    if (isSpeaking) {
      stop();
      return;
    }
    const script = getMainMenuIntroScript(locale);
    speak({
      speaker: script.speaker,
      text: script.text,
      locale,
      category: 'MANUAL',
      userInitiated: true,
    });
  };

  const requestStartGame = (nextParams: NewGameParams) => {
    if (hasSave && latestSaveMeta) {
      setPendingNewParams(nextParams);
      return;
    }
    onStartGame(nextParams);
  };

  const secondaryItems = [
    {
      id: 'story',
      label: t('story.gallery.openBtn'),
      icon: <Award className="w-4 h-4 shrink-0 text-[#D9A66C]" aria-hidden="true" />,
      onClick: onOpenEndingGallery,
    },
    {
      id: 'saves',
      label: t('titleScreen.saveManagement'),
      icon: <FolderOpen className="w-4 h-4 shrink-0 text-[#303B38]/80" aria-hidden="true" />,
      onClick: onOpenSaveLoad,
    },
    {
      id: 'customize',
      label: t('titleScreen.customizeSetup'),
      icon: <SlidersHorizontal className="w-4 h-4 shrink-0 text-[#303B38]/80" aria-hidden="true" />,
      onClick: () => setShowCustom(true),
    },
    {
      id: 'settings',
      label: t('settings.menuBtn'),
      icon: <Settings className="w-4 h-4 shrink-0 text-[#303B38]/80" aria-hidden="true" />,
      onClick: () => setShowSettingsModal(true),
    },
  ];

  const hasSavedRun = Boolean(hasSave && latestSaveMeta);
  const isVi = locale === 'vi-VN';

  return (
    <>
      <div lang={locale} className="fixed inset-0 z-20 overflow-y-auto pointer-events-none">
        {/* Blurred & overlay-faded static office artwork */}
        <img
          src="/assets/aistudio/Asset_01___Main_Office_Environment_2159ecb8.png"
          alt=""
          aria-hidden="true"
          className="fixed inset-0 w-full h-full object-cover object-center scale-[1.07] blur-[2.5px] opacity-90 pointer-events-none select-none"
        />

        {/* Warm cream fade scrim for menu contrast and cozy morning sunlight depth */}
        <div
          className="fixed inset-0 pointer-events-none bg-[#F3F0E7]/55 md:bg-gradient-to-r md:from-[#F3F0E7]/90 md:via-[#F3F0E7]/58 md:to-[#303B38]/12"
          aria-hidden="true"
        />
        <div
          className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_68%_32%,rgba(255,244,212,0.24)_0%,rgba(48,59,56,0.16)_100%)]"
          aria-hidden="true"
        />

        {/* Subtle floating office dust motes catching ambient window light */}
        <TitleDustOverlay />

        <div className="relative z-10 min-h-full flex items-center justify-center md:justify-start px-3 sm:px-6 md:px-12 lg:px-16 py-5">
          <div className="w-full max-w-[480px] bg-[#F3F0E7]/95 border-2 border-[#303B38] p-5 sm:p-7 shadow-[0_14px_34px_rgba(48,59,56,0.16)] pointer-events-auto">
            {/* Top Utility Strip: Language Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-[#303B38]/15">
              <LanguageSelector compact />
              <span className="text-[12px] font-bold tracking-wide text-[#303B38]/70 whitespace-normal">
                {t('app.title')}
              </span>
            </div>

            {/* Cozy Indie Title Hero */}
            <div className="flex items-start gap-3.5 mb-5">
              <PixelAvatar
                appearance={{
                  skinTone: '#F1C6A8',
                  hairColor: '#303B38',
                  hairStyle: 'SHORT',
                  shirtColor: '#78978A',
                  pantsColor: '#303B38',
                  hasGlasses: false,
                }}
                size={60}
                isFounder
                moodTone="HAPPY"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-[21px] sm:text-[25px] font-bold tracking-tight text-[#303B38] leading-snug break-words">
                  {t('titleScreen.welcomeHeadline')}
                </h1>
                <p className="text-[14px] text-[#303B38]/80 mt-0.5 leading-snug break-words">
                  {t('titleScreen.welcomeSubline')}
                </p>
              </div>
            </div>

            {pendingNewParams && latestSaveMeta ? (
              <div className="bg-[#FAF8F2] border-2 border-[#303B38] p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-[#D9A66C] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1 min-w-0">
                    <h2 className="text-[16px] font-bold text-[#303B38] leading-snug">
                      {t('titleScreen.confirmNewTitle')}
                    </h2>
                    <p className="text-[14px] text-[#303B38]/85 leading-relaxed break-words">
                      {t('titleScreen.confirmNewBody', { company: latestSaveMeta.companyName })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPendingNewParams(null)}
                    className="min-h-[44px] flex-1 min-w-[120px] px-3.5 py-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[14px] font-bold text-[#303B38] transition-colors cursor-pointer whitespace-normal text-center leading-snug"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = pendingNewParams;
                      setPendingNewParams(null);
                      onStartGame(next);
                    }}
                    className="min-h-[44px] flex-1 min-w-[150px] px-3.5 py-2 bg-[#78978A] hover:bg-[#6A897C] border-2 border-[#303B38] text-[14px] font-bold text-[#303B38] transition-colors cursor-pointer whitespace-normal text-center leading-snug"
                  >
                    {t('titleScreen.confirmNewAction')}
                  </button>
                </div>
              </div>
            ) : !showCustom ? (
              <div className="space-y-4">
                {/* Primary Tier: Dominant Start New Game & Continue Game buttons */}
                <div
                  role="group"
                  aria-label={t('titleScreen.primaryActionsLabel')}
                  className="flex flex-col gap-2.5"
                >
                  {hasSavedRun && latestSaveMeta ? (
                    <>
                      <button
                        type="button"
                        onClick={onContinueGame}
                        className="w-full min-h-[60px] flex flex-col items-center justify-center gap-0.5 bg-[#303B38] hover:bg-[#3B4743] border-2 border-[#303B38] text-[#F3F0E7] py-3 px-4 transition-all duration-150 hover:-translate-y-0.5 cursor-pointer text-center"
                      >
                        <span className="inline-flex items-center justify-center gap-2 text-[16px] sm:text-[17px] font-bold leading-snug whitespace-normal">
                          <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                          <span>{t('titleScreen.continueSaved')}</span>
                        </span>
                        <span className="text-[12px] text-[#F3F0E7]/85 font-mono-num whitespace-normal break-words leading-snug">
                          {t('titleScreen.continueMeta', {
                            company: latestSaveMeta.companyName,
                            year: latestSaveMeta.year,
                            month: latestSaveMeta.month,
                            day: latestSaveMeta.day,
                          })}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => requestStartGame(DEFAULT_NEW_GAME_PARAMS)}
                        className="w-full min-h-[54px] flex items-center justify-center gap-2 bg-[#78978A] hover:bg-[#6A897C] border-2 border-[#303B38] text-[#303B38] text-[16px] sm:text-[17px] font-bold py-3 px-4 transition-all duration-150 hover:-translate-y-0.5 cursor-pointer whitespace-normal text-center leading-snug"
                      >
                        <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{t('titleScreen.startNew')}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => requestStartGame(DEFAULT_NEW_GAME_PARAMS)}
                        className="w-full min-h-[56px] flex items-center justify-center gap-2 bg-[#78978A] hover:bg-[#6A897C] border-2 border-[#303B38] text-[#303B38] text-[16px] sm:text-[17px] font-bold py-3 px-4 transition-all duration-150 hover:-translate-y-0.5 cursor-pointer whitespace-normal text-center leading-snug"
                      >
                        <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                        <span>{t('titleScreen.startNew')}</span>
                      </button>

                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="w-full min-h-[56px] flex flex-col items-center justify-center gap-0.5 bg-[#FAF8F2]/85 border-2 border-dashed border-[#303B38]/30 text-[#303B38]/65 py-2.5 px-4 text-center cursor-not-allowed"
                      >
                        <span className="text-[15px] sm:text-[16px] font-bold leading-snug whitespace-normal">
                          {t('titleScreen.continueSaved')}
                        </span>
                        <span className="text-[12px] text-[#303B38]/55 whitespace-normal break-words leading-snug">
                          {t('titleScreen.emptySaveTitle')} · {t('titleScreen.emptySaveHint')}
                        </span>
                      </button>
                    </>
                  )}
                </div>

                {/* Secondary Tier: Responsive list giving Vietnamese & English labels unobstructed width */}
                <nav
                  aria-label={t('titleScreen.secondaryMenuLabel')}
                  className="bg-[#FAF8F2]/80 border border-[#303B38]/20 divide-y divide-[#303B38]/12"
                >
                  {secondaryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className="group w-full min-h-[46px] flex items-center justify-between gap-3 px-3.5 sm:px-4 py-2.5 text-left text-[#303B38] hover:bg-[#EAE5D8]/80 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 min-w-0 flex-1">
                        {item.icon}
                        <span
                          className={`font-bold whitespace-normal break-words leading-snug ${
                            isVi ? 'text-[14px] sm:text-[15px]' : 'text-[14px]'
                          }`}
                        >
                          {item.label}
                        </span>
                      </span>
                      <ChevronRight
                        className="w-4 h-4 shrink-0 text-[#303B38]/45 transition-transform duration-150 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </nav>

                {/* Separated Intro Actions: Watch Intro vs Listen to Intro */}
                <div className="flex flex-col min-[400px]:flex-row items-stretch gap-2 pt-1 border-t border-[#303B38]/12">
                  <button
                    type="button"
                    onClick={onWatchIntro}
                    className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/25 text-[13px] font-bold text-[#303B38] transition-colors cursor-pointer whitespace-normal text-center leading-snug"
                  >
                    <Film className="w-4 h-4 shrink-0 text-[#78978A]" aria-hidden="true" />
                    <span>{t('titleScreen.watchIntro')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleIntroVoice}
                    className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/25 text-[13px] font-bold text-[#303B38] transition-colors cursor-pointer whitespace-normal text-center leading-snug"
                  >
                    {isSpeaking ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                        <span>{t('common.stopAudio')}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 shrink-0 text-[#78978A]" aria-hidden="true" />
                        <span>{t('titleScreen.listenIntro')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                requestStartGame(params);
              }}
            >
              <div>
                <label htmlFor="title-company-name" className="block text-[14px] font-bold text-[#303B38] mb-1">
                  {t('titleScreen.companyName')}
                </label>
                <input
                  id="title-company-name"
                  type="text"
                  maxLength={28}
                  required
                  value={params.companyName}
                  onChange={(e) => setParams({ ...params, companyName: e.target.value })}
                  className="w-full min-h-[44px] bg-[#FAF8F2] border border-[#303B38]/35 px-3 py-2 text-[15px] text-[#303B38]"
                />
              </div>

              <div>
                <label htmlFor="title-founder-name" className="block text-[14px] font-bold text-[#303B38] mb-1">
                  {t('titleScreen.founderName')}
                </label>
                <input
                  id="title-founder-name"
                  type="text"
                  maxLength={24}
                  required
                  value={params.founderName}
                  onChange={(e) => setParams({ ...params, founderName: e.target.value })}
                  className="w-full min-h-[44px] bg-[#FAF8F2] border border-[#303B38]/35 px-3 py-2 text-[15px] text-[#303B38]"
                />
              </div>

              <div>
                <label htmlFor="title-business-type" className="block text-[14px] font-bold text-[#303B38] mb-1">
                  {t('titleScreen.businessType')}
                </label>
                <select
                  id="title-business-type"
                  value={params.businessType}
                  onChange={(e) => setParams({ ...params, businessType: e.target.value as BusinessType })}
                  className="w-full min-h-[44px] bg-[#FAF8F2] border border-[#303B38]/35 px-3 py-2 text-[15px] text-[#303B38]"
                >
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {t(`titleScreen.business.${bt}.label`)} — {t(`titleScreen.business.${bt}.hint`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="title-difficulty" className="block text-[14px] font-bold text-[#303B38] mb-1">
                    {t('titleScreen.startingCapital')}
                  </label>
                  <select
                    id="title-difficulty"
                    value={params.difficulty}
                    onChange={(e) =>
                      setParams({ ...params, difficulty: e.target.value as DifficultyLevel })
                    }
                    className="w-full min-h-[44px] bg-[#FAF8F2] border border-[#303B38]/35 px-3 py-2 text-[14px] text-[#303B38]"
                  >
                    {DIFFICULTY_LEVELS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {t(`titleScreen.difficulty.${d.value}`)} ({formatCurrency(d.cash)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="title-mode" className="block text-[14px] font-bold text-[#303B38] mb-1">
                    {t('titleScreen.gameMode')}
                  </label>
                  <select
                    id="title-mode"
                    value={params.gameMode}
                    onChange={(e) => setParams({ ...params, gameMode: e.target.value as GameMode })}
                    className="w-full min-h-[44px] bg-[#FAF8F2] border border-[#303B38]/35 px-3 py-2 text-[14px] text-[#303B38]"
                  >
                    <option value="CAMPAIGN">{t('titleScreen.modeCampaign')}</option>
                    <option value="SANDBOX">{t('titleScreen.modeSandbox')}</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="min-h-[44px] px-4 py-2 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[#303B38] text-[14px] font-bold cursor-pointer whitespace-normal"
                >
                  {t('common.back')}
                </button>
                <button
                  type="submit"
                  className="flex-1 min-w-[160px] min-h-[44px] bg-[#78978A] hover:bg-[#6A897C] border-2 border-[#303B38] text-[#303B38] font-bold py-2 px-4 text-[15px] cursor-pointer whitespace-normal text-center"
                >
                  {t('titleScreen.launchCompany')}
                </button>
              </div>
            </form>
          )}

          {/* Optional Player Account Bar (Guest-first, zero barrier) */}
          <div className="mt-4 pt-3 border-t border-[#303B38]/12 space-y-2">
            {sessionExpiredNotice && !user && (
              <div className="bg-[#D9A66C]/25 border border-[#303B38]/30 px-2.5 py-1.5 flex items-center justify-between gap-2 text-[12px] text-[#303B38]">
                <span>{t('auth.sessionExpiredNotice')}</span>
                <button
                  type="button"
                  onClick={clearExpiredNotice}
                  className="font-bold underline cursor-pointer shrink-0"
                >
                  {t('hud.dismiss')}
                </button>
              </div>
            )}

            {user ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#303B38]">
                <span className="inline-flex items-center gap-1.5 font-bold min-w-0">
                  <User className="w-3.5 h-3.5 text-[#78978A] shrink-0" aria-hidden="true" />
                  <span className="truncate">{user.email}</span>
                </span>
                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={handleLogout}
                  className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/25 text-[12px] font-bold text-[#303B38] cursor-pointer disabled:opacity-60"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('auth.logoutBtn')}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#303B38]">
                <span className="inline-flex items-center gap-1.5 text-[#303B38]/75 font-bold">
                  <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{t('auth.guestTitle')}</span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthModalMode('LOGIN')}
                    className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/25 text-[12px] font-bold text-[#303B38] cursor-pointer whitespace-normal"
                  >
                    <LogIn className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{t('auth.loginBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthModalMode('REGISTER')}
                    className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/25 text-[12px] font-bold text-[#303B38] cursor-pointer whitespace-normal"
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{t('auth.createAccountBtn')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {authModalMode && (
        <AuthModal initialMode={authModalMode} onClose={() => setAuthModalMode(null)} />
      )}
    </>
  );
};
