import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { getTutorialVoiceScript } from '@/src/audio/voiceRegistry';
import { PixelAvatar } from '@/src/components/PixelAvatar';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useVoiceOver } from '@/src/hooks/useVoiceOver';
import { getRoomLocalized, getTutorialStepLocalized } from '@/src/localization/i18n';
import { CharacterMood, GameCommand, GameState } from '@/src/types/game';
import { ActiveModal } from './GameHUD';

interface TutorialGuideProps {
  state: GameState;
  onDispatch: (cmd: GameCommand) => void;
  onNavigate?: (target: ActiveModal) => void;
}

const STEP_MOODS: Record<number, CharacterMood> = {
  1: 'HAPPY',
  2: 'THOUGHTFUL',
  3: 'DETERMINED',
  4: 'NEUTRAL',
  5: 'HAPPY',
  6: 'SURPRISED',
  7: 'THOUGHTFUL',
  8: 'DETERMINED',
};


export const TutorialGuide: React.FC<TutorialGuideProps> = ({ state, onDispatch }) => {
  const { locale, t } = useLocalization();
  const { speak, stop, isSpeaking } = useVoiceOver();
  const [collapsed, setCollapsed] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const tut = state.tutorial;

  if (!tut || !tut.active || tut.completed || tut.skipped) return null;

  const locStep = getTutorialStepLocalized(tut.currentStep, locale);
  const ceoRoomName = getRoomLocalized('CEO_OFFICE', 0, locale).name;
  const engRoomName = getRoomLocalized('ENGINEERING', 0, locale).name;

  const handleListenStep = () => {
    if (isSpeaking) {
      stop();
      return;
    }
    const script = getTutorialVoiceScript(tut.currentStep, locale);
    speak({
      speaker: script.speaker,
      text: script.text,
      locale,
      category: 'TUTORIAL',
      userInitiated: true,
    });
  };

  if (collapsed) {
    return (
      <section
        aria-label={t('tutorial.header', { step: tut.currentStep })}
        className="pointer-events-auto bg-[#F3F0E7]/95 border border-[#303B38] w-full max-w-[280px] sm:max-w-[300px] shadow-sm"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          aria-label={t('tutorial.expandAria')}
          className="w-full min-h-[42px] px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-[#EAE5D8] cursor-pointer"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="px-1.5 py-0.5 text-[12px] font-bold font-mono-num bg-[#78978A]/35 border border-[#303B38]/30 text-[#303B38] shrink-0">
              {t('tutorial.progressLabel', { step: tut.currentStep })}
            </span>
            <span className="text-[14px] font-bold text-[#303B38] truncate">{locStep.title}</span>
          </span>
          <ChevronDown className="w-4 h-4 text-[#303B38] shrink-0" aria-hidden="true" />
        </button>
        <div
          role="progressbar"
          aria-valuenow={tut.currentStep}
          aria-valuemin={1}
          aria-valuemax={8}
          aria-label={t('tutorial.header', { step: tut.currentStep })}
          className="w-full h-1.5 bg-[#EAE5D8] border-t border-[#303B38]/20 flex divide-x divide-[#303B38]/15"
        >
          {Array.from({ length: 8 }, (_, idx) => (
            <span
              key={idx}
              className={`flex-1 h-full transition-colors duration-300 ${
                idx < tut.currentStep ? 'bg-[#78978A]' : 'bg-transparent'
              }`}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={t('tutorial.header', { step: tut.currentStep })}
      className="pointer-events-auto bg-[#F3F0E7]/96 border-2 border-[#303B38] w-full max-w-[290px] sm:max-w-[308px] shadow-sm"
    >
      {/* Header: Step Indicator + Collapse + Hide/Skip */}
      <div className="px-3 py-1.5 bg-[#FAF8F2] border-b border-[#303B38]/20 flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold font-mono-num text-[#303B38]">
          {t('tutorial.header', { step: tut.currentStep })}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleListenStep}
            title={t('tutorial.listenStep')}
            aria-label={t('tutorial.listenStep')}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[#303B38] hover:bg-[#EAE5D8] border border-[#303B38]/20 cursor-pointer"
          >
            {isSpeaking ? (
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-expanded
            aria-label={t('tutorial.collapseAria')}
            title={t('tutorial.collapseAria')}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[#303B38] hover:bg-[#EAE5D8] border border-[#303B38]/20 cursor-pointer"
          >
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmSkip((v) => !v)}
            aria-label={t('tutorial.skip')}
            title={t('tutorial.skip')}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[#303B38] hover:bg-[#EAE5D8] border border-[#303B38]/20 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body: Avatar + Short Title + One Short Instruction + Progress Bar */}
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-0.5">
            <PixelAvatar
              appearance={state.founder.appearance}
              size={44}
              isFounder
              moodTone={STEP_MOODS[tut.currentStep] ?? 'NEUTRAL'}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-[#303B38] leading-snug">{locStep.title}</h3>
            <p className="text-[14px] text-[#303B38]/90 leading-snug mt-0.5">{locStep.actionPrompt}</p>
          </div>
        </div>

        {tut.currentStep === 2 && (
          <div className="flex flex-wrap gap-3 text-[13px] text-[#303B38]">
            <span className="inline-flex items-center gap-1 font-bold">
              {tut.exploredCeoOffice ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#78978A]" aria-hidden="true" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-[#303B38]/55" aria-hidden="true" />
              )}
              {ceoRoomName}
            </span>
            <span className="inline-flex items-center gap-1 font-bold">
              {tut.exploredEngineering ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#78978A]" aria-hidden="true" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-[#303B38]/55" aria-hidden="true" />
              )}
              {engRoomName}
            </span>
          </div>
        )}

        {(tut.currentStep > 1 || tut.manualHoldStep === tut.currentStep) && !confirmSkip && (
          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            {tut.currentStep > 1 && (
              <button
                type="button"
                onClick={() => onDispatch({ type: 'TUTORIAL_BACK' })}
                className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F2] hover:bg-[#EAE5D8] border border-[#303B38]/25 text-[13px] font-bold text-[#303B38] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('tutorial.backBtn')}</span>
              </button>
            )}
            {tut.manualHoldStep === tut.currentStep && (
              <button
                type="button"
                onClick={() => onDispatch({ type: 'TUTORIAL_NEXT' })}
                className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38]/35 text-[13px] font-bold text-[#303B38] cursor-pointer"
              >
                <span>{t('tutorial.nextStepBtn')}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {confirmSkip && (
          <div className="bg-[#FAF8F2] border border-[#303B38]/30 p-2 space-y-1.5">
            <div className="text-[13px] font-bold text-[#303B38]">{t('tutorial.skipConfirm')}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmSkip(false)}
                className="flex-1 min-h-[36px] bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/30 text-[13px] font-bold text-[#303B38] cursor-pointer"
              >
                {t('tutorial.keepLearning')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmSkip(false);
                  onDispatch({ type: 'SKIP_TUTORIAL' });
                }}
                className="flex-1 min-h-[36px] bg-[#303B38] hover:bg-[#3F4D49] text-[13px] font-bold text-[#F3F0E7] cursor-pointer"
              >
                {t('tutorial.confirmSkip')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slim visually integrated step progress bar along the bottom edge */}
      <div
        role="progressbar"
        aria-valuenow={tut.currentStep}
        aria-valuemin={1}
        aria-valuemax={8}
        aria-label={t('tutorial.header', { step: tut.currentStep })}
        className="w-full h-1.5 bg-[#EAE5D8] border-t border-[#303B38]/20 flex divide-x divide-[#303B38]/15"
      >
        {Array.from({ length: 8 }, (_, idx) => (
          <span
            key={idx}
            className={`flex-1 h-full transition-colors duration-300 ${
              idx < tut.currentStep ? 'bg-[#78978A]' : 'bg-transparent'
            }`}
          />
        ))}
      </div>
    </section>
  );
};
