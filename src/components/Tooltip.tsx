import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocalization } from '@/src/hooks/useLocalization';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ComputedTooltipPosition {
  left: number;
  top: number;
  placement: TooltipPlacement;
}

export function computeTooltipPosition(
  triggerRect: TooltipRect,
  tooltipSize: { width: number; height: number },
  preferredPlacement: TooltipPlacement,
  viewport: { width: number; height: number },
  offset = 8,
  margin = 10
): ComputedTooltipPosition {
  const { width: tw, height: th } = tooltipSize;
  const { width: vw, height: vh } = viewport;

  const fitsTop = triggerRect.top - offset - th >= margin;
  const fitsBottom = triggerRect.bottom + offset + th <= vh - margin;
  const fitsLeft = triggerRect.left - offset - tw >= margin;
  const fitsRight = triggerRect.right + offset + tw <= vw - margin;

  let placement = preferredPlacement;
  if (preferredPlacement === 'top' && !fitsTop && fitsBottom) {
    placement = 'bottom';
  } else if (preferredPlacement === 'bottom' && !fitsBottom && fitsTop) {
    placement = 'top';
  } else if (preferredPlacement === 'left' && !fitsLeft) {
    placement = fitsRight ? 'right' : fitsTop ? 'top' : 'bottom';
  } else if (preferredPlacement === 'right' && !fitsRight) {
    placement = fitsLeft ? 'left' : fitsTop ? 'top' : 'bottom';
  }

  let rawLeft = triggerRect.left + triggerRect.width / 2 - tw / 2;
  let rawTop = triggerRect.top - offset - th;

  if (placement === 'bottom') {
    rawLeft = triggerRect.left + triggerRect.width / 2 - tw / 2;
    rawTop = triggerRect.bottom + offset;
  } else if (placement === 'left') {
    rawLeft = triggerRect.left - offset - tw;
    rawTop = triggerRect.top + triggerRect.height / 2 - th / 2;
  } else if (placement === 'right') {
    rawLeft = triggerRect.right + offset;
    rawTop = triggerRect.top + triggerRect.height / 2 - th / 2;
  }

  const maxLeft = Math.max(margin, vw - tw - margin);
  const maxTop = Math.max(margin, vh - th - margin);

  return {
    left: Math.round(Math.max(margin, Math.min(maxLeft, rawLeft))),
    top: Math.round(Math.max(margin, Math.min(maxTop, rawTop))),
    placement,
  };
}

export interface TooltipProps {
  /** Localization dictionary key for the hint body */
  hintKey?: string;
  /** Interpolation variables for hintKey */
  hintVars?: Record<string, string | number>;
  /** Optional localization dictionary key for a bold heading above the hint */
  titleKey?: string;
  /** Interpolation variables for titleKey */
  titleVars?: Record<string, string | number>;
  /** Optional pre-localized hint body (overrides hintKey when provided) */
  content?: React.ReactNode;
  /** Optional pre-localized heading (overrides titleKey when provided) */
  title?: React.ReactNode;
  placement?: TooltipPlacement;
  delayMs?: number;
  disabled?: boolean;
  /** Classes applied to the inline wrapper element around children */
  wrapperClassName?: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({
  hintKey,
  hintVars,
  titleKey,
  titleVars,
  content,
  title,
  placement = 'top',
  delayMs = 160,
  disabled = false,
  wrapperClassName = 'inline-flex min-w-0 max-w-full',
  children,
}) => {
  const { t } = useLocalization();
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<number | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<ComputedTooltipPosition | null>(null);

  const resolvedTitle = title ?? (titleKey ? t(titleKey, titleVars) : undefined);
  const resolvedBody = content ?? (hintKey ? t(hintKey, hintVars) : undefined);
  const hasHint = Boolean(resolvedTitle || resolvedBody);

  const clearTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setIsOpen(false);
  }, [clearTimer]);

  const showWithDelay = useCallback(() => {
    if (disabled || !hasHint) return;
    clearTimer();
    if (delayMs <= 0) {
      setIsOpen(true);
      return;
    }
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      setIsOpen(true);
    }, delayMs);
  }, [clearTimer, delayMs, disabled, hasHint]);

  const showImmediate = useCallback(() => {
    if (disabled || !hasHint) return;
    clearTimer();
    setIsOpen(true);
  }, [clearTimer, disabled, hasHint]);

  useEffect(() => {
    if (disabled || !hasHint) {
      hide();
    }
  }, [disabled, hasHint, hide]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    const tipEl = tooltipRef.current;
    if (!triggerEl || !tipEl || typeof window === 'undefined') return;

    const tr = triggerEl.getBoundingClientRect();
    const tipRect = tipEl.getBoundingClientRect();
    const next = computeTooltipPosition(
      {
        left: tr.left,
        top: tr.top,
        right: tr.right,
        bottom: tr.bottom,
        width: tr.width,
        height: tr.height,
      },
      {
        width: tipRect.width || 240,
        height: tipRect.height || 48,
      },
      placement,
      {
        width: window.innerWidth,
        height: window.innerHeight,
      }
    );
    setCoords(next);
  }, [placement]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [isOpen, resolvedBody, resolvedTitle, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hide();
      }
    };
    const handleScrollOrResize = () => {
      hide();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [hide, isOpen]);

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <>
      <span
        ref={triggerRef}
        aria-describedby={isOpen && hasHint ? tooltipId : undefined}
        onMouseEnter={showWithDelay}
        onMouseLeave={hide}
        onFocus={showImmediate}
        onBlur={hide}
        className={wrapperClassName}
      >
        {children}
      </span>

      {isOpen &&
        hasHint &&
        portalTarget &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            style={{
              position: 'fixed',
              left: coords ? `${coords.left}px` : '-9999px',
              top: coords ? `${coords.top}px` : '-9999px',
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="z-50 pointer-events-none max-w-[280px] bg-[#303B38] text-[#F3F0E7] border-2 border-[#78978A] px-3 py-2 shadow-sm text-[13px] leading-snug font-normal"
          >
            {resolvedTitle && (
              <div className="font-bold text-[#F3F0E7] mb-0.5">{resolvedTitle}</div>
            )}
            {resolvedBody && (
              <div className="text-[#F3F0E7]/95">{resolvedBody}</div>
            )}
          </div>,
          portalTarget
        )}
    </>
  );
};
