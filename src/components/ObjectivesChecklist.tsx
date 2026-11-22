import React, { useState } from 'react';
import { CheckSquare, ChevronDown, ChevronUp, Square } from 'lucide-react';
import { useLocalization } from '@/src/hooks/useLocalization';
import { getObjectiveLocalized } from '@/src/localization/i18n';
import { StartupObjective } from '@/src/types/game';

interface ObjectivesChecklistProps {
  objectives: StartupObjective[];
  hiddenOnSmall?: boolean;
}

export const ObjectivesChecklist: React.FC<ObjectivesChecklistProps> = ({
  objectives,
  hiddenOnSmall = false,
}) => {
  const { locale, t } = useLocalization();
  const [collapsed, setCollapsed] = useState(false);

  if (!objectives || objectives.length === 0) return null;
  const doneCount = objectives.filter((o) => o.completed).length;

  return (
    <aside
      aria-label={t('objectives.panelTitle')}
      className={`pointer-events-auto bg-[#F3F0E7]/95 border border-[#303B38]/35 w-68 sm:w-76 shadow-sm ${
        hiddenOnSmall ? 'hidden lg:block' : 'block'
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between gap-2 bg-[#FAF8F2] hover:bg-[#EAE5D8] border-b border-[#303B38]/15 text-left cursor-pointer"
        aria-expanded={!collapsed}
      >
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-[#303B38]">
            {t('objectives.panelTitle')}
          </div>
          <div className="text-[13px] text-[#303B38]/80 font-mono-num">
            {t('objectives.completedCount', { done: doneCount, total: objectives.length })}
          </div>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-[#303B38] shrink-0" aria-hidden="true" />
        ) : (
          <ChevronUp className="w-4 h-4 text-[#303B38] shrink-0" aria-hidden="true" />
        )}
      </button>

      {!collapsed && (
        <div className="p-3 space-y-2">
          <div
            className="w-full h-2 bg-[#EAE5D8] border border-[#303B38]/20 overflow-hidden"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={objectives.length}
          >
            <div
              className="h-full bg-[#78978A] transition-all duration-300"
              style={{ width: `${(doneCount / objectives.length) * 100}%` }}
            />
          </div>

          <ul className="space-y-1.5">
            {objectives.map((obj) => {
              const label = getObjectiveLocalized(obj.id, obj.label, locale).label;
              return (
                <li
                  key={obj.id}
                  className="flex items-start gap-2 text-[14px] leading-snug text-[#303B38]"
                >
                  {obj.completed ? (
                    <CheckSquare
                      className="w-4 h-4 text-[#303B38] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <Square
                      className="w-4 h-4 text-[#303B38]/55 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  )}
                  <span className={obj.completed ? 'line-through text-[#303B38]/65' : 'font-normal'}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
};
