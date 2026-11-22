import React, { useEffect, useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { PixelAvatar } from '@/src/components/PixelAvatar';
import { useLocalization } from '@/src/hooks/useLocalization';
import { CharacterAppearance } from '@/src/types/game';

export type DialogueTextSpeed = 'SLOW' | 'NORMAL' | 'FAST';

interface DialogueBoxProps {
  speaker?: string;
  text: string;
  subtext?: string;
  avatar?: CharacterAppearance | null;
  isFounder?: boolean;
  moodTone?: 'HAPPY' | 'NEUTRAL' | 'STRESSED';
  textSpeed: DialogueTextSpeed;
  autoAdvance: boolean;
  showSubtitles: boolean;
  canGoNext?: boolean;
  isLastBeat?: boolean;
  onAdvance: () => void;
}

const CHAR_DELAY_MS: Record<DialogueTextSpeed, number> = {
  SLOW: 34,
  NORMAL: 20,
  FAST: 8,
};

export const DialogueBox: React.FC<DialogueBoxProps> = ({
  speaker,
  text,
  subtext,
  avatar = null,
  isFounder = false,
  moodTone = 'NEUTRAL',
  textSpeed,
  autoAdvance,
  showSubtitles,
  canGoNext = true,
  isLastBeat = false,
  onAdvance,
}) => {
  const { t } = useLocalization();
  const [visibleChars, setVisibleChars] = useState(0);

  useEffect(() => {
    setVisibleChars(0);
    if (!text) return;
    const delay = CHAR_DELAY_MS[textSpeed];
    const id = window.setInterval(() => {
      setVisibleChars((prev) => {
        if (prev >= text.length) {
          window.clearInterval(id);
          return prev;
        }
        return prev + 1;
      });
    }, delay);
    return () => window.clearInterval(id);
  }, [text, textSpeed]);

  const fullyRevealed = visibleChars >= text.length;
  const shownText = text.slice(0, visibleChars);

  const handleInteract = () => {
    if (!fullyRevealed) {
      setVisibleChars(text.length);
      return;
    }
    if (canGoNext) onAdvance();
  };

  if (!showSubtitles) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleInteract}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 bg-[#78978A] hover:bg-[#6A897C] border-2 border-[#303B38] text-[14px] font-bold text-[#303B38] cursor-pointer shadow-sm"
        >
          <span>{isLastBeat ? t('story.controls.finish') : t('story.controls.next')}</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-live="polite"
      onClick={handleInteract}
      className="w-full max-w-2xl mx-auto bg-[#F3F0E7]/96 border-2 border-[#303B38] px-4 py-3.5 sm:px-5 sm:py-4 shadow-md cursor-pointer select-none"
    >
      <div className="flex items-start gap-3.5">
        {avatar ? (
          <div className="shrink-0 hidden sm:block">
            <PixelAvatar
              appearance={avatar}
              size={52}
              isFounder={isFounder}
              moodTone={moodTone}
            />
          </div>
        ) : (
          <div className="w-10 h-10 bg-[#D9A66C]/35 border border-[#303B38]/30 hidden sm:flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 text-[#303B38]" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            {speaker && (
              <span className="inline-block px-2 py-0.5 bg-[#EAE5D8] border border-[#303B38]/25 text-[12px] font-bold text-[#303B38]">
                {speaker}
              </span>
            )}
            {subtext && (
              <span className="text-[12px] font-bold text-[#303B38]/70 truncate">
                {subtext}
              </span>
            )}
          </div>

          <p className="text-[15px] sm:text-[16px] text-[#303B38] leading-relaxed font-medium min-h-[2.8rem]">
            {shownText}
          </p>

          <div className="mt-2 pt-2 border-t border-[#303B38]/15 flex items-center justify-between gap-3">
            <span className="text-[12px] text-[#303B38]/65">
              {autoAdvance ? t('story.controls.autoOnHint') : t('story.controls.clickContinue')}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleInteract();
              }}
              className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1 bg-[#78978A] hover:bg-[#6A897C] border border-[#303B38] text-[13px] font-bold text-[#303B38] cursor-pointer shrink-0"
            >
              <span>
                {!fullyRevealed
                  ? t('story.controls.reveal')
                  : isLastBeat
                    ? t('story.controls.finish')
                    : t('story.controls.next')}
              </span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
