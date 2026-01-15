import { GuidanceState, StageKey } from '../types';
import { applyGuidanceUpdate, createDefaultGuidanceState } from '../utils/guidance';
import { loadFromStorage, saveToStorage } from '../utils/storage';

const KEY = 'command-generator-guidance';

export const loadGuidanceState = (): GuidanceState => {
  const parsed = loadFromStorage<GuidanceState | null>(KEY, null);
  if (!parsed || typeof parsed !== 'object') return createDefaultGuidanceState();
  return {
    stageStatus: parsed.stageStatus ?? createDefaultGuidanceState().stageStatus,
    history: Array.isArray(parsed.history) ? parsed.history : [],
    last: parsed.last ?? null,
  };
};

export const saveGuidanceState = (state: GuidanceState) => {
  saveToStorage(KEY, state);
};

export const recordGuidanceSuccess = (command: string, stage: StageKey, ts = Date.now()) => {
  const current = loadGuidanceState();
  const next = applyGuidanceUpdate(current, command, stage, ts);
  saveGuidanceState(next);
  return next;
};
