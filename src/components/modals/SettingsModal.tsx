import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Home,
  Keyboard,
  LogIn,
  LogOut,
  RotateCcw,
  User,
  UserPlus,
} from 'lucide-react';
import { AudioSettingsSection } from '@/src/components/AudioSettingsSection';
import { LanguageSelector } from '@/src/components/LanguageSelector';
import { VoiceSettings } from '@/src/components/VoiceSettings';
import { DEFAULT_NEW_GAME_PARAMS } from '@/src/game/engine/initGame';
import { useAuth } from '@/src/hooks/useAuth';
import { useLocalization } from '@/src/hooks/useLocalization';
import { GameState, NewGameParams } from '@/src/types/game';
import { AuthModal, AuthModalMode } from './AuthModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { ModalFrame } from './ModalFrame';

interface SettingsModalProps {
  state?: GameState;
  onRestartTutorial?: () => void;
  onResetGame?: (params: NewGameParams) => void;
  onReturnTitle?: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  state,
  onRestartTutorial,
  onResetGame,
  onReturnTitle,
  onClose,
}) => {
  const { t } = useLocalization();
  const { user, sessionExpiredNotice, clearExpiredNotice, logout } = useAuth();
  const [confirmReset, setConfirmReset] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode | null>(null);
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

  return (
    <>
      <ModalFrame title={t('settings.title')} onClose={onClose} maxWidth="max-w-2xl">
        <div className="space-y-4 text-[15px]">
          <AudioSettingsSection />

          {/* Account Section */}
          <section
            aria-label={t('auth.sectionTitle')}
            className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#303B38]">
                <User className="w-4 h-4 text-[#78978A] shrink-0" aria-hidden="true" />
                <h3 className="text-[16px] font-bold leading-tight">{t('auth.sectionTitle')}</h3>
              </div>
              <span className="text-[12px] font-bold px-2 py-0.5 border border-[#303B38]/25 bg-[#F3F0E7] text-[#303B38]">
                {user ? t('auth.signedInStatus') : t('auth.guestTitle')}
              </span>
            </div>

            {sessionExpiredNotice && !user && (
              <div className="bg-[#D9A66C]/25 border border-[#303B38]/30 px-3 py-2 flex items-center justify-between gap-2 text-[13px] text-[#303B38]">
                <span>{t('auth.sessionExpiredNotice')}</span>
                <button
                  type="button"
                  onClick={clearExpiredNotice}
                  className="text-[12px] font-bold underline cursor-pointer shrink-0"
                >
                  {t('hud.dismiss')}
                </button>
              </div>
            )}

            {user ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F3F0E7] border border-[#303B38]/20 p-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-[#303B38] truncate">{user.email}</div>
                  <div className="text-[13px] text-[#303B38]/75">{t('auth.localSavesIntact')}</div>
                </div>
                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={handleLogout}
                  className="min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[14px] font-bold text-[#303B38] cursor-pointer shrink-0 disabled:opacity-60"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span>{t('auth.logoutBtn')}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F3F0E7] border border-[#303B38]/20 p-3">
                <p className="text-[13px] text-[#303B38]/85 leading-snug">
                  {t('auth.guestDesc')}
                </p>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAuthModalMode('LOGIN')}
                    className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[14px] font-bold text-[#303B38] cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    <span>{t('auth.loginBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthModalMode('REGISTER')}
                    className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[14px] font-bold text-[#303B38] cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" aria-hidden="true" />
                    <span>{t('auth.createAccountBtn')}</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          <LanguageSelector />

          <div className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-[15px] text-[#303B38]">
                  {t('settings.controlsTitle')}
                </div>
                <div className="text-[13px] text-[#303B38]/80 mt-0.5">
                  {t('settings.controlsDesc')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[14px] font-bold text-[#303B38] cursor-pointer shrink-0"
              >
                <Keyboard className="w-4 h-4" aria-hidden="true" />
                {t('settings.openShortcutsBtn')}
              </button>
            </div>
            <div className="pt-2 border-t border-[#303B38]/15 text-[14px] text-[#303B38]/90 space-y-1">
              <div>{t('settings.ctrlMove')}</div>
              <div>{t('settings.ctrlSpeed')}</div>
            </div>
          </div>

          <details className="bg-[#FAF8F2] border border-[#303B38]/25">
            <summary className="min-h-[44px] px-4 py-3 flex items-center justify-between gap-2 font-bold text-[15px] text-[#303B38] cursor-pointer list-none">
              <span>{t('voice.panelTitle')}</span>
              <ChevronDown className="w-4 h-4 text-[#303B38]/75" aria-hidden="true" />
            </summary>
            <div className="px-4 pb-4">
              <VoiceSettings />
            </div>
          </details>

          {(onRestartTutorial || onReturnTitle || (state && onResetGame)) && (
            <div className="space-y-2.5 pt-2 border-t border-[#303B38]/20">
              {onRestartTutorial && (
                <button
                  type="button"
                  onClick={() => {
                    onRestartTutorial();
                    onClose();
                  }}
                  className="min-h-[44px] w-full flex items-center justify-center gap-2 py-2.5 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[15px] font-bold text-[#303B38] cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  {t('settings.reviewTutorial')}
                </button>
              )}

              {onReturnTitle && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onReturnTitle();
                  }}
                  className="min-h-[44px] w-full flex items-center justify-center gap-2 py-2.5 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[15px] font-bold text-[#303B38] cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  {t('settings.returnTitle')}
                </button>
              )}

              {state && onResetGame && (
                !confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="min-h-[44px] w-full flex items-center justify-center gap-2 py-2.5 bg-[#EAE5D8] hover:bg-[#303B38] hover:text-[#F3F0E7] border border-[#303B38]/35 text-[15px] font-bold text-[#303B38] cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t('settings.resetFresh')}
                  </button>
                ) : (
                  <div className="bg-[#FAF8F2] border-2 border-[#303B38] p-3.5 space-y-2.5">
                    <div className="text-[15px] text-[#303B38]">
                      {t('settings.resetConfirm', { company: state.config.companyName })}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="min-h-[44px] flex-1 py-2 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/35 text-[14px] font-bold text-[#303B38] cursor-pointer"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onResetGame(DEFAULT_NEW_GAME_PARAMS);
                          onClose();
                        }}
                        className="min-h-[44px] flex-1 py-2 bg-[#303B38] hover:bg-[#303B38]/90 text-[14px] font-bold text-[#F3F0E7] cursor-pointer"
                      >
                        {t('settings.confirmReset')}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </ModalFrame>

      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {authModalMode && (
        <AuthModal initialMode={authModalMode} onClose={() => setAuthModalMode(null)} />
      )}
    </>
  );
};
