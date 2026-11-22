import { ENDING_ORDER } from '@/src/game/data/storyData';
import {
  EndingId,
  EvaluatedEndingSummary,
  GameState,
  UnlockedEndingRecord,
} from '@/src/types/game';

export const ENDING_GALLERY_STORAGE_KEY = 'startup_founder_ending_gallery_v1';

export function getUnlockedEndings(): UnlockedEndingRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(ENDING_GALLERY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is UnlockedEndingRecord =>
        Boolean(item) &&
        typeof item.endingId === 'string' &&
        ENDING_ORDER.includes(item.endingId as EndingId) &&
        Boolean(item.summary)
    );
  } catch {
    return [];
  }
}

export function getUnlockedEndingRecord(
  endingId: EndingId
): UnlockedEndingRecord | null {
  return getUnlockedEndings().find((r) => r.endingId === endingId) ?? null;
}

export function recordUnlockedEnding(
  state: GameState,
  summary: EvaluatedEndingSummary
): UnlockedEndingRecord[] {
  const existing = getUnlockedEndings();
  const nextRecord: UnlockedEndingRecord = {
    endingId: summary.endingId,
    unlockedAt: Date.now(),
    companyName: state.config.companyName,
    founderName: state.founder.name,
    summary,
  };
  const filtered = existing.filter((r) => r.endingId !== summary.endingId);
  const updated = [...filtered, nextRecord].sort(
    (a, b) => ENDING_ORDER.indexOf(a.endingId) - ENDING_ORDER.indexOf(b.endingId)
  );
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ENDING_GALLERY_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Non-blocking storage error
  }
  return updated;
}

export function clearUnlockedEndings(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ENDING_GALLERY_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}
