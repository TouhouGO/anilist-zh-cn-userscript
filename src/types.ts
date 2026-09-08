export type Section = 'global' | 'home' | 'search' | 'media' | 'list' | 'profile' | 'forum' | 'notifications' | 'settings' | 'other';
export type Route = { section: Section; type?: 'anime' | 'manga'; id?: number; path: string };
export type TranslationContext = { section: Section; element?: Element };
export type UiDictionary = Record<string, string>;
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const memoryStorage: StorageLike = {
  getItem: () => null,
  setItem: () => {},
};

declare const GM_getValue: (<T>(key: string, defaultValue?: T) => T) | undefined;
declare const GM_setValue: (<T>(key: string, value: T) => void) | undefined;

export function getSafeStorage(storage?: StorageLike): StorageLike {
  if (storage) return storage;
  try {
    if (typeof GM_getValue === 'function' && typeof GM_setValue === 'function') {
      return {
        getItem: (key: string) => {
          const val = GM_getValue<string | null>(key, null);
          return typeof val === 'string' ? val : (val != null ? JSON.stringify(val) : null);
        },
        setItem: (key: string, value: string) => {
          GM_setValue(key, value);
        },
      };
    }
  } catch {
    // fallback if GM API throws or is unavailable
  }
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // In Node.js 22, accessing localStorage throws ReferenceError
  }
  return memoryStorage;
}

