import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLocalization } from '@/src/hooks/useLocalization';

interface ModalFrameProps {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export const ModalFrame: React.FC<ModalFrameProps> = ({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'max-w-4xl',
}) => {
  const { t } = useLocalization();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs.length > 0 && dialogs[dialogs.length - 1] !== dialogRef.current) {
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-30 pointer-events-auto flex items-end sm:items-center justify-center bg-[#303B38]/45 p-0 sm:p-4 md:p-6 box-border"
    >
      <div
        className={`w-full ${maxWidth} h-[96dvh] sm:h-auto sm:max-h-[90vh] bg-[#F3F0E7] border-2 border-[#303B38] shadow-lg flex flex-col min-h-0 min-w-0 overflow-hidden text-[#303B38] box-border`}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#303B38]/20 bg-[#FAF8F2] min-w-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] sm:text-[24px] font-bold text-[#303B38] leading-snug break-words">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[13px] sm:text-[14px] text-[#303B38]/80 mt-0.5 leading-snug">
                {subtitle}
              </p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              data-tutorial-target="modal-close-btn"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#F3F0E7] hover:bg-[#EAE5D8] border border-[#303B38]/30 text-[#303B38] cursor-pointer shrink-0"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div
          data-modal-scroll-body="true"
          className="p-3.5 sm:p-5 overflow-y-auto overflow-x-hidden flex-1 min-h-0 min-w-0 text-[15px] leading-relaxed box-border"
        >
          {children}
        </div>
      </div>
    </div>
  );
};
