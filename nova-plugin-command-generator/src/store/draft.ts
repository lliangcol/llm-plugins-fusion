import { Attachment, FormState } from '../types';
import { loadFromStorage, saveToStorage } from '../utils/storage';

export interface GeneratorDraft {
  selectedCommandId: string;
  formState: FormState;
  variables: Record<string, string>;
  attachments: Attachment[];
  attachmentTarget: string;
  attachmentMode: 'path' | 'snippet' | 'full';
  previewOverride: string | null;
  savedAt: number;
}

const KEY = 'command-generator-draft';

export const loadDraft = (): GeneratorDraft | null => {
  const parsed = loadFromStorage<GeneratorDraft | null>(KEY, null);
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed;
};

export const saveDraft = (draft: GeneratorDraft) => {
  saveToStorage(KEY, draft);
};
