import React, { useEffect, useRef, useState } from 'react';
import { Music, Volume2, VolumeX } from 'lucide-react';
import { useAudioSettings } from '@/src/hooks/useAudioSettings';
import { useLocalization } from '@/src/hooks/useLocalization';
import { soundService } from '@/src/services/soundService';

type TestSoundFeedback = 'NONE' | 'MASTER_MUTED' | 'SFX_MUTED' | 'ZERO_VOLUME' | 'PLAYED';

export const AudioSettingsSection: React.FC = () => {
  const { t } = useLocalization();
  const {
    settings,
    setMasterVolume,
    setMasterMuted,
    setBgmVolume,
    setSfxVolume,
    setBgmMuted,
    setSfxMuted,
  } = useAudioSettings();
  const [testFeedback, setTestFeedback] = useState<TestSoundFeedback>('NONE');
  const feedbackTimerRef = useRef<number | null>(null);

  const masterPct = Math.round(settings.masterVolume * 100);
  const bgmPct = Math.round(settings.bgmVolume * 100);
  const sfxPct = Math.round(settings.sfxVolume * 100);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const clearFeedbackTimer = () => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  };

  const handleTestSound = () => {
    clearFeedbackTimer();
    const played = soundService.playTestSound();
    if (!played) {
      setTestFeedback(settings.masterMuted ? 'MASTER_MUTED' : 'SFX_MUTED');
      return;
    }
    if (masterPct === 0 || sfxPct === 0) {
      setTestFeedback('ZERO_VOLUME');
      return;
    }
    setTestFeedback('PLAYED');
    feedbackTimerRef.current = window.setTimeout(() => {
      setTestFeedback((prev) => (prev === 'PLAYED' ? 'NONE' : prev));
      feedbackTimerRef.current = null;
    }, 1600);
  };

  return (
    <section
      aria-label={t('audio.sectionTitle')}
      className="bg-[#FAF8F2] border border-[#303B38]/25 p-4 space-y-3.5"
    >
      <div className="flex items-center gap-2 text-[#303B38]">
        <Music className="w-4 h-4 text-[#78978A] shrink-0" aria-hidden="true" />
        <h3 className="text-[16px] font-bold leading-tight">{t('audio.sectionTitle')}</h3>
      </div>

      {/* Master Sound */}
      <div className="bg-[#F3F0E7] border border-[#303B38]/25 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="audio-master-slider" className="text-[14px] font-bold text-[#303B38]">
            {t('audio.masterLabel')}
          </label>
          <span className="text-[14px] font-bold font-mono-num tabular-nums text-[#303B38]">
            {masterPct}%
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <input
            id="audio-master-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={masterPct}
            aria-label={t('audio.masterLabel')}
            aria-valuetext={`${masterPct}%`}
            onChange={(e) => {
              const nextVol = Number(e.target.value) / 100;
              setMasterVolume(nextVol);
              if (nextVol > 0 && sfxPct > 0 && testFeedback === 'ZERO_VOLUME') {
                setTestFeedback('NONE');
              }
            }}
            className="w-full h-6 accent-[#78978A] cursor-pointer"
          />
          <button
            type="button"
            onClick={() => {
              const nextMuted = !settings.masterMuted;
              setMasterMuted(nextMuted);
              if (!nextMuted && testFeedback === 'MASTER_MUTED') {
                setTestFeedback('NONE');
              }
            }}
            aria-pressed={settings.masterMuted}
            aria-label={`${settings.masterMuted ? t('audio.unmuteBtn') : t('audio.muteBtn')} - ${t('audio.masterLabel')}`}
            className={`min-h-[40px] sm:min-w-[120px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border text-[14px] font-bold cursor-pointer shrink-0 transition-colors ${
              settings.masterMuted
                ? 'bg-[#EAE5D8] border-[#303B38]/35 text-[#303B38]'
                : 'bg-[#78978A] border-[#303B38] text-[#303B38]'
            }`}
          >
            {settings.masterMuted ? (
              <>
                <VolumeX className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('audio.unmuteBtn')}</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('audio.muteBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Music */}
      <div className="bg-[#F3F0E7] border border-[#303B38]/20 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="audio-bgm-slider" className="text-[14px] font-bold text-[#303B38]">
            {t('audio.bgmLabel')}
          </label>
          <span className="text-[14px] font-bold font-mono-num tabular-nums text-[#303B38]">
            {bgmPct}%
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <input
            id="audio-bgm-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={bgmPct}
            aria-label={t('audio.bgmLabel')}
            aria-valuetext={`${bgmPct}%`}
            onChange={(e) => setBgmVolume(Number(e.target.value) / 100)}
            className="w-full h-6 accent-[#78978A] cursor-pointer"
          />
          <button
            type="button"
            onClick={() => setBgmMuted(!settings.bgmMuted)}
            aria-pressed={settings.bgmMuted}
            aria-label={`${settings.bgmMuted ? t('audio.unmuteBtn') : t('audio.muteBtn')} - ${t('audio.bgmLabel')}`}
            className={`min-h-[40px] sm:min-w-[120px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border text-[14px] font-bold cursor-pointer shrink-0 transition-colors ${
              settings.bgmMuted
                ? 'bg-[#EAE5D8] border-[#303B38]/35 text-[#303B38]'
                : 'bg-[#78978A] border-[#303B38] text-[#303B38]'
            }`}
          >
            {settings.bgmMuted ? (
              <>
                <VolumeX className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('audio.unmuteBtn')}</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('audio.muteBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sound Effects */}
      <div className="bg-[#F3F0E7] border border-[#303B38]/20 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="audio-sfx-slider" className="text-[14px] font-bold text-[#303B38]">
            {t('audio.sfxLabel')}
          </label>
          <span className="text-[14px] font-bold font-mono-num tabular-nums text-[#303B38]">
            {sfxPct}%
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <input
            id="audio-sfx-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={sfxPct}
            aria-label={t('audio.sfxLabel')}
            aria-valuetext={`${sfxPct}%`}
            onChange={(e) => {
              const nextVol = Number(e.target.value) / 100;
              setSfxVolume(nextVol);
              if (nextVol > 0 && masterPct > 0 && testFeedback === 'ZERO_VOLUME') {
                setTestFeedback('NONE');
              }
            }}
            className="w-full h-6 accent-[#78978A] cursor-pointer"
          />
          <button
            type="button"
            onClick={() => {
              const nextMuted = !settings.sfxMuted;
              setSfxMuted(nextMuted);
              if (!nextMuted && testFeedback === 'SFX_MUTED') {
                setTestFeedback('NONE');
              }
            }}
            aria-pressed={settings.sfxMuted}
            aria-label={`${settings.sfxMuted ? t('audio.unmuteBtn') : t('audio.muteBtn')} - ${t('audio.sfxLabel')}`}
            className={`min-h-[40px] sm:min-w-[120px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border text-[14px] font-bold cursor-pointer shrink-0 transition-colors ${
              settings.sfxMuted
                ? 'bg-[#EAE5D8] border-[#303B38]/35 text-[#303B38]'
                : 'bg-[#78978A] border-[#303B38] text-[#303B38]'
            }`}
          >
            {settings.sfxMuted ? (
              <>
                <VolumeX className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('audio.unmuteBtn')}</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('audio.muteBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleTestSound}
          className={`min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 border text-[14px] font-bold text-[#303B38] cursor-pointer transition-colors ${
            testFeedback === 'PLAYED'
              ? 'bg-[#78978A]/35 border-[#303B38]'
              : 'bg-[#F3F0E7] hover:bg-[#EAE5D8] border-[#303B38]/35'
          }`}
        >
          <Volume2 className="w-4 h-4" aria-hidden="true" />
          <span>{t('audio.testSoundBtn')}</span>
        </button>

        {testFeedback === 'MASTER_MUTED' && settings.masterMuted && (
          <span role="status" className="text-[13px] text-[#303B38]/80">
            {t('audio.masterMutedHint')}
          </span>
        )}
        {testFeedback === 'SFX_MUTED' && !settings.masterMuted && settings.sfxMuted && (
          <span role="status" className="text-[13px] text-[#303B38]/80">
            {t('audio.sfxMutedHint')}
          </span>
        )}
        {testFeedback === 'ZERO_VOLUME' &&
          !settings.masterMuted &&
          !settings.sfxMuted &&
          (masterPct === 0 || sfxPct === 0) && (
            <span role="status" className="text-[13px] text-[#303B38]/80">
              {t('audio.sfxZeroHint')}
            </span>
          )}
        {testFeedback === 'PLAYED' &&
          !settings.masterMuted &&
          !settings.sfxMuted &&
          masterPct > 0 &&
          sfxPct > 0 && (
            <span role="status" className="text-[13px] font-medium text-[#303B38]/85">
              {t('audio.testPlayedHint')}
            </span>
          )}
      </div>
    </section>
  );
};
