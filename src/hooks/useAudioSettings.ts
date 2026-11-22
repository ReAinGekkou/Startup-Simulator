import { useEffect, useState } from 'react';
import { audioManager } from '@/src/audio/audioManager';
import { AudioSettings } from '@/src/audio/audioSettings';

export function useAudioSettings() {
  const [settings, setSettings] = useState<AudioSettings>(() => audioManager.getSettings());

  useEffect(() => {
    setSettings(audioManager.getSettings());
    return audioManager.subscribe(() => {
      setSettings(audioManager.getSettings());
    });
  }, []);

  return {
    settings,
    setMasterVolume: (v: number) => audioManager.setMasterVolume(v),
    setMasterMuted: (m: boolean) => audioManager.setMasterMuted(m),
    setBgmVolume: (v: number) => audioManager.setBgmVolume(v),
    setSfxVolume: (v: number) => audioManager.setSfxVolume(v),
    setBgmMuted: (m: boolean) => audioManager.setBgmMuted(m),
    setSfxMuted: (m: boolean) => audioManager.setSfxMuted(m),
  };
}
