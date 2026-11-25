import React from 'react';
import { CharacterAppearance, CharacterMood, CharacterState } from '@/src/types/game';

interface PixelAvatarProps {
  appearance: CharacterAppearance;
  size?: number;
  isFounder?: boolean;
  moodTone?: CharacterMood;
  status?: CharacterState;
  statusLabel?: string;
  className?: string;
}

export function getPortraitStatusClass(status?: CharacterState): string {
  switch (status) {
    case 'IDLE':
      return 'animate-portrait-idle';
    case 'WORKING':
      return 'animate-portrait-working';
    case 'WALKING':
      return 'animate-portrait-walking';
    case 'RESTING':
      return 'animate-portrait-resting';
    case 'MEETING':
    case 'CHATTING':
      return 'animate-portrait-social';
    case 'OFF_DUTY':
      return 'animate-portrait-offduty';
    default:
      return '';
  }
}

export const PixelAvatar: React.FC<PixelAvatarProps> = ({
  appearance,
  size = 56,
  isFounder = false,
  moodTone = 'NEUTRAL',
  status,
  statusLabel,
  className = '',
}) => {
  const bg =
    moodTone === 'HAPPY'
      ? '#DCE7E1'
      : moodTone === 'STRESSED'
        ? '#F1DED9'
        : moodTone === 'SURPRISED'
          ? '#E2EAF4'
          : moodTone === 'THOUGHTFUL'
            ? '#E8E4F0'
            : moodTone === 'DETERMINED'
              ? '#F5EBE0'
              : '#EAE5D8';
  const statusAnimClass = getPortraitStatusClass(status);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden={statusLabel ? undefined : true}
      aria-label={statusLabel || undefined}
      data-status={status}
      className={`border border-[#303B38]/30 shrink-0 ${statusAnimClass} ${className}`}
      style={{ backgroundColor: bg }}
    >
      {statusLabel && <title>{statusLabel}</title>}
      {/* Warm indoor wall subtle top trim */}
      <rect x="0" y="13" width="16" height="3" fill="#D9A66C" fillOpacity="0.22" />

      {/* Shoulders & Shirt */}
      <rect x="3" y="11" width="10" height="5" fill={appearance.shirtColor} />
      <rect x="4" y="11" width="8" height="1" fill="rgba(255,255,255,0.22)" />
      <rect x="3" y="14" width="10" height="2" fill="rgba(0,0,0,0.16)" />

      {/* Neck */}
      <rect x="7" y="10" width="2" height="2" fill={appearance.skinTone} />

      {/* Head */}
      <rect x="4" y="4" width="8" height="7" fill={appearance.skinTone} />
      {/* Warm rosy cheeks */}
      {moodTone !== 'STRESSED' && (
        <>
          <rect x="4" y="8" width="1" height="1" fill="#D68B7B" fillOpacity={moodTone === 'HAPPY' ? '0.7' : '0.45'} />
          <rect x="11" y="8" width="1" height="1" fill="#D68B7B" fillOpacity={moodTone === 'HAPPY' ? '0.7' : '0.45'} />
        </>
      )}

      {/* Stressed Sweat Drop */}
      {moodTone === 'STRESSED' && (
        <rect x="11.5" y="3" width="1" height="1.5" fill="#5B82A6" />
      )}

      {/* Eyes */}
      {moodTone === 'SURPRISED' ? (
        <>
          <rect x="4.8" y="6.5" width="1.4" height="2.5" fill="#303B38" />
          <rect x="9.8" y="6.5" width="1.4" height="2.5" fill="#303B38" />
        </>
      ) : moodTone === 'STRESSED' ? (
        <>
          <rect x="5" y="7.5" width="1.5" height="1" fill="#303B38" />
          <rect x="9.5" y="7.5" width="1.5" height="1" fill="#303B38" />
        </>
      ) : moodTone === 'THOUGHTFUL' ? (
        <>
          <rect x="5" y="6.5" width="1" height="2" fill="#303B38" />
          <rect x="10" y="6.5" width="1" height="2" fill="#303B38" />
        </>
      ) : (
        <>
          <rect x="5" y="7" width="1" height="2" fill="#303B38" />
          <rect x="10" y="7" width="1" height="2" fill="#303B38" />
        </>
      )}

      {/* Eyebrows / Determined slants */}
      {moodTone === 'DETERMINED' && (
        <g fill="none" stroke="#303B38" strokeWidth="0.8">
          <line x1="4.5" y1="6.3" x2="6.3" y2="6.8" />
          <line x1="9.7" y1="6.8" x2="11.5" y2="6.3" />
        </g>
      )}

      {/* Mouth Expressions */}
      {moodTone === 'HAPPY' ? (
        <>
          <rect x="6" y="9" width="4" height="1" fill="#303B38" />
          <rect x="5.5" y="9.5" width="1.5" height="1" fill="#303B38" />
          <rect x="9" y="9.5" width="1.5" height="1" fill="#303B38" />
        </>
      ) : moodTone === 'SURPRISED' ? (
        <rect x="7" y="9" width="2" height="2" fill="#303B38" />
      ) : moodTone === 'STRESSED' ? (
        <>
          <rect x="6" y="9.5" width="4" height="1" fill="#303B38" />
          <rect x="6" y="8.5" width="1" height="1" fill="#303B38" />
          <rect x="9" y="8.5" width="1" height="1" fill="#303B38" />
        </>
      ) : moodTone === 'THOUGHTFUL' ? (
        <rect x="6.5" y="9.5" width="3" height="1" fill="#303B38" />
      ) : moodTone === 'DETERMINED' ? (
        <rect x="5.5" y="9.5" width="5" height="1" fill="#303B38" />
      ) : (
        <rect x="6" y="9.5" width="4" height="1" fill="#303B38" />
      )}

      {/* Glasses */}
      {appearance.hasGlasses && (
        <g fill="none" stroke="#303B38" strokeWidth="0.6">
          <rect x="4.5" y="6.5" width="2.5" height="2.5" />
          <rect x="9" y="6.5" width="2.5" height="2.5" />
          <line x1="7" y1="7.5" x2="9" y2="7.5" />
        </g>
      )}

      {/* Hair */}
      {appearance.hairStyle !== 'BALD' && (
        <>
          <rect x="3" y="2" width="10" height="3" fill={appearance.hairColor} />
          <rect x="4" y="2" width="8" height="1" fill="rgba(255,255,255,0.14)" />
          {(appearance.hairStyle === 'BOB' || appearance.hairStyle === 'PONYTAIL') && (
            <>
              <rect x="3" y="4" width="1" height="5" fill={appearance.hairColor} />
              <rect x="12" y="4" width="1" height="5" fill={appearance.hairColor} />
            </>
          )}
          {appearance.hairStyle === 'SPIKY' && (
            <>
              <rect x="4" y="1" width="2" height="1" fill={appearance.hairColor} />
              <rect x="7" y="1" width="2" height="1" fill={appearance.hairColor} />
              <rect x="10" y="1" width="2" height="1" fill={appearance.hairColor} />
            </>
          )}
        </>
      )}

      {/* Optional CEO Founder Crown */}
      {isFounder && (
        <>
          <rect x="5" y="1" width="6" height="1" fill="#D9A66C" />
          <rect x="5" y="0" width="1" height="1" fill="#E8BF86" />
          <rect x="7" y="0" width="2" height="1" fill="#E8BF86" />
          <rect x="10" y="0" width="1" height="1" fill="#E8BF86" />
        </>
      )}
    </svg>
  );
};
