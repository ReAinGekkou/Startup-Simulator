import React, { useEffect, useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { PixelAvatar } from '@/src/components/PixelAvatar';
import { useLocalization } from '@/src/hooks/useLocalization';
import { soundService } from '@/src/services/soundService';
import { CharacterAppearance, CharacterMood } from '@/src/types/game';

export type DialogueTextSpeed = 'SLOW' | 'NORMAL' | 'FAST';

interface DialogueBoxProps {
  speaker?: string;
  text: string;
  subtext?: string;
  avatar?: CharacterAppearance | null;
  isFounder?: boolean;
  moodTone?: CharacterMood;
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
  const [displayMood, setDisplayMood] = useState(moodTone);
  const [displayAvatar, setDisplayAvatar] = useState(avatar);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (moodTone === displayMood && avatar === displayAvatar) return;
    setIsFading(true);
    const timer = window.setTimeout(() => {
      setDisplayMood(moodTone);
      setDisplayAvatar(avatar);
      setIsFading(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [moodTone, avatar, displayMood, displayAvatar]);

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
        const next = prev + 1;
        const char = text[next - 1];
        if (char && char.trim() !== '') {
          soundService.play('TYPEWRITER_CLICK');
        }
        return next;
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
        {displayAvatar ? (
          <div className={`shrink-0 hidden sm:block transition-all duration-200 transform ${isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            <PixelAvatar
              appearance={displayAvatar}
              size={52}
              isFounder={isFounder}
              moodTone={displayMood}
            />
          </div>
        ) : (
          <div className={`w-10 h-10 bg-[#D9A66C]/35 border border-[#303B38]/30 hidden sm:flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 transform ${isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
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
