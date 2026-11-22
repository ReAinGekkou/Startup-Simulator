import React from 'react';
import { BookOpen } from 'lucide-react';
import { ModalFrame } from '@/src/components/modals/ModalFrame';
import { getStoryEventTemplate } from '@/src/game/systems/storyEventSystem';
import { useLocalization } from '@/src/hooks/useLocalization';
import { GameState, StoryEventInstance } from '@/src/types/game';

interface StoryEventModalProps {
  storyEvent: StoryEventInstance;
  state: GameState;
  onChoose: (choiceId: string) => void;
}

export const StoryEventModal: React.FC<StoryEventModalProps> = ({
  storyEvent,
  state,
  onChoose,
}) => {
  const { t, formatCurrency } = useLocalization();
  const template = getStoryEventTemplate(storyEvent.id);
  if (!template) return null;

  const relatedEmp = storyEvent.relatedEmployeeId
    ? state.employees.find((e) => e.id === storyEvent.relatedEmployeeId)
    : state.employees[0];
  const relatedProd = storyEvent.relatedProductId
    ? state.products.find((p) => p.id === storyEvent.relatedProductId)
    : state.products[0];

  const vars = {
    company: state.config.companyName,
    founder: state.founder.name,
    employee: relatedEmp?.name ?? state.employees[0]?.name ?? 'Team',
    product: relatedProd?.name ?? state.products[0]?.name ?? 'Product',
    amount: formatCurrency(storyEvent.offerValuation ?? 200_000, false),
  };

  return (
    <ModalFrame
      title={t(template.titleKey, vars)}
      subtitle={`${t('story.chapterPrefix', { n: storyEvent.chapter })} — ${t(`story.chapters.c${storyEvent.chapter}.title`)}`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-[15px] text-[#303B38]">
        <div className="flex items-start gap-3 bg-[#FAF8F2] border border-[#303B38]/20 p-3.5">
          <div className="w-8 h-8 bg-[#D9A66C]/35 border border-[#303B38]/30 flex items-center justify-center shrink-0 mt-0.5">
            <BookOpen className="w-4 h-4 text-[#303B38]" aria-hidden="true" />
          </div>
          <p className="leading-relaxed text-[#303B38]/95">
            {t(template.descKey, vars)}
          </p>
        </div>

        <div className="space-y-2.5">
          {template.choices.map((choice) => {
            const cost = choice.cost ?? 0;
            const affordable =
              cost === 0 ||
              state.finance.cash - cost >= -state.finance.creditLimit;
            return (
              <button
                key={choice.id}
                type="button"
                disabled={!affordable}
                onClick={() => onChoose(choice.id)}
                className="w-full text-left bg-[#FAF8F2] hover:bg-[#EAE5D8] disabled:opacity-50 border-2 border-[#303B38]/35 hover:border-[#303B38] p-3.5 transition-colors cursor-pointer disabled:cursor-not-allowed space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[15px] text-[#303B38]">
                    {t(choice.labelKey, vars)}
                  </span>
                  {cost > 0 && (
                    <span className="px-2 py-0.5 bg-[#D9A66C]/30 border border-[#303B38]/25 font-mono-num text-[12px] font-bold">
                      -{formatCurrency(cost, false)}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[#303B38]/80 leading-snug">
                  {t(choice.descKey, vars)}
                </p>
                <div className="text-[12px] font-bold text-[#78978A] pt-0.5">
                  {t(choice.effectsKey, vars)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ModalFrame>
  );
};
