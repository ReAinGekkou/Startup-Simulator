import React from 'react';
import { Play, Square, Volume2 } from 'lucide-react';
import { useLocalization } from '@/src/hooks/useLocalization';
import { useVoiceOver } from '@/src/hooks/useVoiceOver';
import { soundService } from '@/src/services/soundService';

export const VoiceSettings: React.FC = () => {
  const { locale, t } = useLocalization();
  const {
    settings,
    updateSettings,
    voicesForLocale,
    hasVietnameseVoice,
    isSupported,
    isSpeaking,
    testVoice,
    stop,
  } = useVoiceOver();

  const soundMuted = soundService.isMuted();

  return (
    <div className="rounded-xl border border-[#303B38]/20 bg-[#FAF8F2] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#303B38]">
            <Volume2 size={17} />
            <h4 className="text-[16px] font-bold">{t('voice.panelTitle')}</h4>
          </div>
          <p className="text-[13px] text-[#303B38]/75 mt-1 leading-snug">
            {t('voice.enableDesc')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => updateSettings({ enabled: !settings.enabled })}
          className={`shrink-0 px-3.5 py-2 rounded-lg text-[14px] font-bold border transition-colors ${
            settings.enabled
              ? 'bg-[#78978A] text-[#303B38] border-[#303B38]/35'
              : 'bg-[#F3F0E7] text-[#303B38] border-[#303B38]/25'
          }`}
        >
          {settings.enabled ? t('common.enabled') : t('common.disabled')}
        </button>
      </div>

      {/* Availability status badge */}
      {!isSupported ? (
        <div className="rounded-lg border border-[#303B38]/25 bg-[#F3F0E7] p-3 text-[13px] text-[#303B38] leading-snug">
          {t('voice.unsupportedWarning')}
        </div>
      ) : locale === 'vi-VN' && !hasVietnameseVoice ? (
        <div className="rounded-lg border border-[#303B38]/30 bg-[#E6E1D4]/75 p-3 space-y-1">
          <div className="text-[13px] font-bold text-[#303B38]">{t('voice.noViVoiceBadge')}</div>
          <p className="text-[13px] text-[#303B38]/85 leading-snug">
            {t('voice.noViVoiceWarning')}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[#303B38]/15 bg-[#F3F0E7] px-3 py-2 text-[13px] font-bold text-[#303B38]">
          {locale === 'vi-VN'
            ? t('voice.viVoiceReadyBadge', { count: voicesForLocale.length })
            : t('voice.enVoiceReadyBadge', { count: voicesForLocale.length })}
        </div>
      )}

      {soundMuted && (
        <div className="rounded-lg border border-[#303B38]/20 bg-[#F3F0E7] px-3 py-2 text-[13px] text-[#303B38]/85">
          {t('voice.mutedNote')}
        </div>
      )}

      {/* Voice selector */}
      <div className="space-y-1.5">
        <label className="block text-[14px] font-bold text-[#303B38]">
          {t('voice.selectVoice')}
        </label>
        <select
          value={settings.voiceURI}
          onChange={(e) => updateSettings({ voiceURI: e.target.value })}
          disabled={!isSupported || voicesForLocale.length === 0}
          className="w-full rounded-lg border border-[#303B38]/25 bg-[#F3F0E7] px-3 py-2 text-[14px] text-[#303B38] disabled:opacity-60"
        >
          <option value="">{t('voice.autoVoiceOption', { lang: locale })}</option>
          {voicesForLocale.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      {/* Rate & Volume */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#303B38]/15 bg-[#F3F0E7] p-3">
          <div className="flex justify-between text-[14px] mb-1.5">
            <span className="font-bold text-[#303B38]">{t('voice.rateLabel')}</span>
            <span className="font-bold font-mono-num text-[#303B38]">
              {settings.rate.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={0.7}
            max={1.3}
            step={0.05}
            value={settings.rate}
            onChange={(e) => updateSettings({ rate: Number(e.target.value) })}
            className="w-full accent-[#78978A]"
          />
        </div>

        <div className="rounded-lg border border-[#303B38]/15 bg-[#F3F0E7] p-3">
          <div className="flex justify-between text-[14px] mb-1.5">
            <span className="font-bold text-[#303B38]">{t('voice.volumeLabel')}</span>
            <span className="font-bold font-mono-num text-[#303B38]">
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            className="w-full accent-[#78978A]"
          />
        </div>
      </div>

      {/* Auto-read triggers */}
      <div className="space-y-2">
        <div className="text-[14px] font-bold text-[#303B38]">{t('voice.autoReadTitle')}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(
            [
              ['autoReadTutorial', 'voice.autoReadTutorial'],
              ['autoReadReports', 'voice.autoReadReports'],
              ['autoReadNotifications', 'voice.autoReadNotifications'],
              ['autoReadDialogue', 'voice.autoReadDialogue'],
              ['autoReadObjectives', 'voice.autoReadObjectives'],
            ] as const
          ).map(([field, labelKey]) => (
            <label
              key={field}
              className="flex items-center gap-2 rounded-lg border border-[#303B38]/15 bg-[#F3F0E7] px-3 py-2 text-[13px] text-[#303B38] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={settings[field]}
                onChange={(e) => updateSettings({ [field]: e.target.checked })}
                className="h-4 w-4 accent-[#78978A]"
              />
              <span>{t(labelKey)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Test & Stop actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={testVoice}
          className="inline-flex items-center gap-2 rounded-lg bg-[#78978A] hover:bg-[#6A887B] text-[#303B38] border border-[#303B38]/35 px-4 py-2 text-[14px] font-bold transition-colors cursor-pointer"
        >
          <Play size={15} />
          {t('voice.testVoiceBtn')}
        </button>

        <button
          type="button"
          onClick={stop}
          disabled={!isSpeaking}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F3F0E7] hover:bg-[#E6E1D4] text-[#303B38] border border-[#303B38]/25 px-4 py-2 text-[14px] font-bold transition-colors disabled:opacity-45"
        >
          <Square size={14} />
          {t('voice.stopVoiceBtn')}
        </button>
      </div>
    </div>
  );
};
