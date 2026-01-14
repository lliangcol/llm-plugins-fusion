import { HistoryEntry } from '../types';

const KEY = 'command-generator-history';

export const loadHistory = (): HistoryEntry[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return parsed;
  } catch {
    return [];
  }
};

export const saveHistory = (entries: HistoryEntry[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 100)));
  } catch {
    // ignore
  }
};

export const addHistory = (entry: HistoryEntry) => {
  const list = loadHistory();
  list.unshift(entry);
  saveHistory(list);
  return list;
};
