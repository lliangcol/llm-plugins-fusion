import { logError } from './telemetry';

export const loadFromStorage = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    logError(error, { source: 'storage.load', key });
    return fallback;
  }
};

export const saveToStorage = <T>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    logError(error, { source: 'storage.save', key });
  }
};
