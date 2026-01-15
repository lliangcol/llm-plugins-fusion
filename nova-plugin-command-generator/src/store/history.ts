import { HistoryEntry } from '../types';
import { loadFromStorage, saveToStorage } from '../utils/storage';

const KEY = 'command-generator-history';

export const loadHistory = (): HistoryEntry[] => {
  const parsed = loadFromStorage<HistoryEntry[]>(KEY, []);
  return Array.isArray(parsed) ? parsed : [];
};

export const saveHistory = (entries: HistoryEntry[]) => {
  saveToStorage(KEY, entries.slice(0, 100));
};

export const addHistory = (entry: HistoryEntry) => {
  const list = loadHistory();
  list.unshift(entry);
  saveHistory(list);
  return list;
};
