import React, { useId } from 'react';
import { ScreenRect } from '@/src/components/OfficeCanvas';

export type TutorialArrowDirection = 'down' | 'up' | 'left' | 'right' | 'curved';

interface TutorialArrowProps {
  targetRect: ScreenRect;
  direction: TutorialArrowDirection;
  tooltip: string;
  showTooltip?: boolean;
  dimBackground?: boolean;
  pulseTargetFrame?: boolean;
  currentStep?: number;
  totalSteps?: number;
}

function clampVal(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export const TutorialArrow: React.FC<TutorialArrowProps> = ({
  targetRect,
  direction,
  tooltip,
  showTooltip = true,
  dimBackground = false,
  pulseTargetFrame = true,
  currentStep,
  totalSteps = 8,
}) => {
  const maskId = useId().replace(/:/g, '_');

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;

  const pad = 6;
  const spotX = Math.max(0, targetRect.left - pad);
  const spotY = Math.max(0, targetRect.top - pad);
  const spotW = Math.max(24, targetRect.width + pad * 2);
  const spotH = Math.max(24, targetRect.height + pad * 2);

  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;

  // Smart auto-flip so arrows & tooltips never clip off-screen or cover the target
  let resolvedDir: TutorialArrowDirection = direction;
  if ((direction === 'left' || direction === 'right') && targetRect.top > vh - 140 && targetRect.top >= 120) {
    resolvedDir = 'down';
  } else if (direction === 'down' && targetRect.top < 120 && vh - targetRect.bottom >= 120) {
    resolvedDir = 'up';
  } else if (direction === 'up' && vh - targetRect.bottom < 120 && targetRect.top >= 120) {
    resolvedDir = 'down';
  } else if (direction === 'left' && vw - targetRect.right < 268) {
    resolvedDir = targetRect.left >= 268 ? 'right' : targetRect.top >= 120 ? 'down' : 'up';
  } else if (direction === 'right' && targetRect.left < 268) {
    resolvedDir = vw - targetRect.right >= 268 ? 'left' : targetRect.top >= 120 ? 'down' : 'up';
  } else if (direction === 'curved' && targetRect.top < 110 && vh - targetRect.bottom >= 110) {
    resolvedDir = 'up';
  }

  const tooltipMaxW = Math.min(248, vw - 24);

  const renderSvgArrow = (dir: TutorialArrowDirection) => {
    if (dir === 'curved') {
      return (
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          className="animate-tutorial-pulse shrink-0 drop-shadow-sm"
        >
          <path
            d="M39 9C27 10 17 18 14 34"
            stroke="#303B38"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <path
            d="M39 9C27 10 17 18 14 34"
            stroke="#D9A66C"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M7 28L13.5 39L23 30.5L15 32.5L7 28Z"
            fill="#D9A66C"
            stroke="#303B38"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    if (dir === 'down') {
      return (
        <svg
          width="34"
          height="38"
          viewBox="0 0 34 38"
          fill="none"
          aria-hidden="true"
          className="animate-tutorial-bounce-down shrink-0"
        >
          <path
            d="M12 4H22V20H30L17 34L4 20H12V4Z"
            fill="#D9A66C"
            stroke="#303B38"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    if (dir === 'up') {
      return (
        <svg
          width="34"
          height="38"
          viewBox="0 0 34 38"
          fill="none"
          aria-hidden="true"
          className="animate-tutorial-bounce-up shrink-0"
        >
          <path
            d="M17 4L30 18H22V34H12V18H4L17 4Z"
            fill="#D9A66C"
            stroke="#303B38"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    if (dir === 'left') {
      return (
        <svg
          width="38"
          height="34"
          viewBox="0 0 38 34"
          fill="none"
          aria-hidden="true"
          className="animate-tutorial-bounce-left shrink-0"
        >
          <path
            d="M4 17L18 4V12H34V22H18V30L4 17Z"
            fill="#D9A66C"
            stroke="#303B38"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    return (
      <svg
        width="38"
        height="34"
        viewBox="0 0 38 34"
        fill="none"
        aria-hidden="true"
        className="animate-tutorial-bounce-right shrink-0"
      >
        <path
          d="M34 17L20 30V22H4V12H20V4L34 17Z"
          fill="#D9A66C"
          stroke="#303B38"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // Compute safe non-overlapping anchor position for arrow + tooltip
  let containerStyle: React.CSSProperties = {};
  let layoutClass = 'flex flex-col items-center gap-1.5';

  if (resolvedDir === 'down') {
    const left = clampVal(centerX - tooltipMaxW / 2, 12, Math.max(12, vw - tooltipMaxW - 12));
    const bottom = Math.max(12, vh - spotY + 8);
    containerStyle = { left, bottom, width: tooltipMaxW };
    layoutClass = 'flex flex-col items-center gap-1.5';
  } else if (resolvedDir === 'up') {
    const left = clampVal(centerX - tooltipMaxW / 2, 12, Math.max(12, vw - tooltipMaxW - 12));
    const top = clampVal(spotY + spotH + 8, 12, Math.max(12, vh - 108));
    containerStyle = { left, top, width: tooltipMaxW };
    layoutClass = 'flex flex-col items-center gap-1.5';
  } else if (resolvedDir === 'left') {
    const left = clampVal(spotX + spotW + 10, 12, Math.max(12, vw - tooltipMaxW - 48));
    const top = clampVal(centerY - 32, 12, Math.max(12, vh - 86));
    containerStyle = { left, top };
    layoutClass = 'flex flex-row items-center gap-2';
  } else if (resolvedDir === 'right') {
    const right = Math.max(12, vw - spotX + 10);
    const top = clampVal(centerY - 32, 12, Math.max(12, vh - 86));
    containerStyle = { right, top };
    layoutClass = 'flex flex-row-reverse items-center gap-2';
  } else {
    // Curved arrow sits cleanly above-right of world target without covering the character or object
    const left = clampVal(centerX + spotW * 0.18, 12, Math.max(12, vw - (showTooltip ? tooltipMaxW + 56 : 58)));
    const bottom = clampVal(vh - spotY + 4, 12, Math.max(12, vh - 96));
    containerStyle = { left, bottom };
    layoutClass = 'flex flex-row items-start gap-1.5';
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[35]" aria-hidden="true">
      {dimBackground && (
        <svg className="fixed inset-0 w-full h-full">
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={spotX}
                y={spotY}
                width={spotW}
                height={spotH}
                rx="3"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(48, 59, 56, 0.22)"
            mask={`url(#${maskId})`}
          />
        </svg>
      )}

      {pulseTargetFrame && (
        <div
          className="fixed border-2 border-[#D9A66C] ring-2 ring-[#303B38]/70 animate-tutorial-pulse"
          style={{
            left: spotX,
            top: spotY,
            width: spotW,
            height: spotH,
          }}
        />
      )}

      <div className={`fixed ${layoutClass}`} style={containerStyle}>
        {(resolvedDir === 'up' || resolvedDir === 'left' || resolvedDir === 'right' || resolvedDir === 'curved') &&
          renderSvgArrow(resolvedDir)}

        {showTooltip && tooltip && (
          <div
            className="bg-[#F3F0E7] border-2 border-[#303B38] text-[#303B38] shadow-sm overflow-hidden"
            style={{ maxWidth: tooltipMaxW }}
          >
            <div className="px-3 py-1.5 text-[13px] font-bold leading-snug">{tooltip}</div>
            {typeof currentStep === 'number' && totalSteps > 0 && (
              <div
                role="progressbar"
                aria-valuenow={Math.min(totalSteps, Math.max(1, currentStep))}
                aria-valuemin={1}
                aria-valuemax={totalSteps}
                className="w-full h-1.5 bg-[#EAE5D8] border-t border-[#303B38]/20 flex divide-x divide-[#303B38]/15"
              >
                {Array.from({ length: totalSteps }, (_, idx) => {
                  const filled = idx < currentStep;
                  return (
                    <span
                      key={idx}
                      className={`flex-1 h-full transition-colors duration-300 ${
                        filled ? 'bg-[#78978A]' : 'bg-transparent'
                      }`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {resolvedDir === 'down' && renderSvgArrow(resolvedDir)}
      </div>
    </div>
  );
};
