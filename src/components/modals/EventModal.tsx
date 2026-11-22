import React from 'react';
import { AlertTriangle, Sparkles, Square, Volume2 } from 'lucide-react';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useVoiceOver } from '@/src/hooks/useVoiceOver';
import { getEventLocalized } from '@/src/localization/i18n';
import { ActiveEvent, GameState } from '@/src/types/game';
import { ModalFrame } from './ModalFrame';

interface EventModalProps {
  event: ActiveEvent;
  state?: GameState;
  cash: number;
  creditLimit: number;
  onChoose: (choiceId: string) => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  event,
  state,
  cash,
  creditLimit,
  onChoose,
}) => {
  const { locale, t, formatCurrency } = useLocalization();
  const { speak, stop, isSpeaking } = useVoiceOver();
  const locEvent = getEventLocalized(event, state, locale);

  const handleToggleListen = () => {
    if (isSpeaking) {
      stop();
      return;
    }
    speak({
      speaker: locEvent.title,
      text: locEvent.description,
      locale,
      category: 'REPORT',
      userInitiated: true,
    });
  };

  return (
    <ModalFrame
      title={locEvent.title}
      subtitle={t('events.subtitle', {
        category: locEvent.categoryLabel,
        day: event.triggeredDay,
      })}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 bg-[#FAF8F2] border border-[#303B38]/25 p-4">
          <div className="flex items-start gap-3">
            {event.severity === 'CRITICAL' || event.severity === 'WARNING' ? (
              <AlertTriangle className="w-5 h-5 text-[#303B38] shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="w-5 h-5 text-[#303B38] shrink-0 mt-0.5" />
            )}
            <p className="text-[15px] text-[#303B38] leading-relaxed">{locEvent.description}</p>
          </div>
          <button
            type="button"
            onClick={handleToggleListen}
            title={t('common.listen')}
            aria-label={t('common.listen')}
            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center px-2.5 bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/30 text-[13px] font-bold text-[#303B38] cursor-pointer shrink-0"
          >
            {isSpeaking ? (
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="space-y-2.5">
          {locEvent.choices.map((c) => {
            const canAfford = !c.cost || cash - c.cost >= -creditLimit;
            return (
              <button
                key={c.id}
                type="button"
                disabled={!canAfford}
                onClick={() => onChoose(c.id)}
                className="min-h-[44px] w-full text-left bg-[#FAF8F2] hover:bg-[#78978A]/25 disabled:opacity-45 border border-[#303B38]/30 hover:border-[#303B38] p-4 transition-colors cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[16px] text-[#303B38]">{c.label}</span>
                  {c.cost ? (
                    <span className="font-mono-num text-[14px] font-bold text-[#303B38]">
                      -{formatCurrency(c.cost)}
                    </span>
                  ) : null}
                </div>
                <p className="text-[14px] text-[#303B38]/85">{c.description}</p>
                <div className="text-[13px] font-mono-num font-bold text-[#303B38] pt-1">
                  {t('events.outcomeLabel', { text: c.effectsSummary })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ModalFrame>
  );
};
