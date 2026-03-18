import { describe, expect, it, beforeEach } from 'vitest';
import { loadFromStorage, saveToStorage } from '../src/utils/storage';

const createMemoryStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe('loadFromStorage', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage =
      createMemoryStorage() as unknown as Storage;
  });

  it('空存储时返回 fallback（null）', () => {
    const result = loadFromStorage<null>('nonexistent-key', null);
    expect(result).toBeNull();
  });

  it('空存储时返回自定义 fallback 值', () => {
    const result = loadFromStorage('missing', { default: true });
    expect(result).toEqual({ default: true });
  });

  it('正常存储的值可以被解析并返回', () => {
    localStorage.setItem('my-key', JSON.stringify({ foo: 'bar' }));
    const result = loadFromStorage<{ foo: string }>('my-key', null);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('JSON 格式错误时返回 fallback', () => {
    localStorage.setItem('bad-json', 'not valid json {{{');
    const result = loadFromStorage('bad-json', 'fallback');
    expect(result).toBe('fallback');
  });

  it('存储数字类型值可正确读回', () => {
    localStorage.setItem('num-key', JSON.stringify(42));
    const result = loadFromStorage('num-key', 0);
    expect(result).toBe(42);
  });
});

describe('saveToStorage', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage =
      createMemoryStorage() as unknown as Storage;
  });

  it('正常写入后可读回', () => {
    saveToStorage('write-key', { hello: 'world' });
    const raw = localStorage.getItem('write-key');
    expect(JSON.parse(raw!)).toEqual({ hello: 'world' });
  });

  it('覆盖已有值', () => {
    saveToStorage('overwrite-key', 'first');
    saveToStorage('overwrite-key', 'second');
    const result = loadFromStorage('overwrite-key', '');
    expect(result).toBe('second');
  });

  it('写入数组类型值后可读回', () => {
    saveToStorage('arr-key', [1, 2, 3]);
    const result = loadFromStorage<number[]>('arr-key', []);
    expect(result).toEqual([1, 2, 3]);
  });
});
