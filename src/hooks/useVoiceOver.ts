import { useCallback, useEffect, useState } from 'react';
import { useLocalization } from '@/src/hooks/useLocalization';
import {
  DeviceVoiceInfo,
  SpeakOptions,
  SubtitleState,
  voiceService,
} from '@/src/audio/voiceService';
import { VoiceSettings } from '@/src/audio/voiceSettings';

export function useVoiceOver() {
  const { locale, t } = useLocalization();
  const [, setTick] = useState(0);

  useEffect(() => {
    voiceService.refreshVoices();
    return voiceService.subscribe(() => setTick((v) => v + 1));
  }, []);

  const settings = voiceService.getSettings();
  const allVoices: DeviceVoiceInfo[] = voiceService.getAvailableVoices();
  const voicesForLocale: DeviceVoiceInfo[] = voiceService.getVoicesForLocale(locale);
  const hasVietnameseVoice = voiceService.hasVietnameseVoice();
  const isSupported = voiceService.isSupported();
  const isSpeaking = voiceService.isSpeaking();
  const subtitle: SubtitleState | null = voiceService.getSubtitle();

  const updateSettings = useCallback((patch: Partial<VoiceSettings>) => {
    voiceService.updateSettings(patch);
  }, []);

  const speak = useCallback(
    (options: SpeakOptions) => {
      voiceService.speak({
        ...options,
        locale: options.locale ?? locale,
      });
    },
    [locale]
  );

  const stop = useCallback(() => {
    voiceService.stop(false);
  }, []);

  const dismissSubtitle = useCallback(() => {
    voiceService.dismissSubtitle();
  }, []);

  const testVoice = useCallback(() => {
    voiceService.speak({
      speaker: t('voice.speakerNarrator'),
      text: t('voice.testPhrase'),
      locale,
      category: 'MANUAL',
      userInitiated: true,
    });
  }, [locale, t]);

  return {
    locale,
    settings,
    updateSettings,
    allVoices,
    voicesForLocale,
    hasVietnameseVoice,
    isSupported,
    isSpeaking,
    subtitle,
    speak,
    stop,
    dismissSubtitle,
    testVoice,
  };
}
