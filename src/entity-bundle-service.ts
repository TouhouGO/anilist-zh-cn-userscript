import { requestJson, type JsonRequester } from './json-request';
import { getSafeStorage, type StorageLike } from './types';

export const BUNDLE_STORAGE_KEY = 'anilist-zh-cn-staff-chars-v1';
export const BUNDLE_URL_PRIMARY = 'https://raw.githubusercontent.com/TouhouGO/anilist-zh-cn-userscript/main/data/staff_characters_zh_cn.json';
export const BUNDLE_URL_FALLBACK = 'https://fastly.jsdelivr.net/gh/TouhouGO/anilist-zh-cn-userscript@main/data/staff_characters_zh_cn.json';

export type EntityBundleService = {
  get(key: string): string | undefined;
  getById(kind: 'character' | 'staff', id: number): string | undefined;
  getByName(name: string): string | undefined;
  isLoaded(): boolean;
  load(): Promise<boolean>;
  setBundle(data: Record<string, string>): void;
};

export function normalizeEntityName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function readStoredBundle(storage: StorageLike): Record<string, string> | null {
  try {
    if (typeof GM_getValue === 'function') {
      const gmData = GM_getValue<string | Record<string, string> | null>(BUNDLE_STORAGE_KEY, null);
      if (gmData) {
        if (typeof gmData === 'object') return gmData;
        return JSON.parse(gmData) as Record<string, string>;
      }
    }
    const raw = storage.getItem(BUNDLE_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* ignore malformed cache */
  }
  return null;
}

function writeStoredBundle(storage: StorageLike, data: Record<string, string>): void {
  try {
    const serialized = JSON.stringify(data);
    if (typeof GM_setValue === 'function') {
      GM_setValue(BUNDLE_STORAGE_KEY, serialized);
    } else {
      storage.setItem(BUNDLE_STORAGE_KEY, serialized);
    }
  } catch {
    /* storage quota exceeded or unavailable */
  }
}

export function createEntityBundleService(
  storage: StorageLike = getSafeStorage(),
  requester: JsonRequester = requestJson,
  initialBundle?: Record<string, string>
): EntityBundleService {
  let bundle: Record<string, string> | null = initialBundle || readStoredBundle(storage);
  let loadingPromise: Promise<boolean> | null = null;

  async function fetchBundle(): Promise<boolean> {
    const urls = [BUNDLE_URL_PRIMARY, BUNDLE_URL_FALLBACK];
    for (const url of urls) {
      try {
        const payload = await requester(url);
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          bundle = payload as Record<string, string>;
          writeStoredBundle(storage, bundle);
          return true;
        }
      } catch {
        /* try next url */
      }
    }
    return false;
  }

  return {
    get(key: string): string | undefined {
      return bundle ? bundle[key] : undefined;
    },
    getById(kind: 'character' | 'staff', id: number): string | undefined {
      if (!bundle || !Number.isInteger(id) || id <= 0) return undefined;
      const prefix = kind === 'character' ? 'char_' : 'person_';
      return bundle[prefix + id];
    },
    getByName(name: string): string | undefined {
      if (!bundle || !name) return undefined;
      const norm = normalizeEntityName(name);
      if (!norm) return undefined;
      const direct = bundle['name_' + norm];
      if (direct) return direct;
      // Try reversed First/Last
      const parts = name.trim().split(/\s+/);
      if (parts.length === 2) {
        const reversed = normalizeEntityName(`${parts[1]} ${parts[0]}`);
        return bundle['name_' + reversed];
      }
      return undefined;
    },
    isLoaded(): boolean {
      return bundle !== null && Object.keys(bundle).length > 0;
    },
    async load(): Promise<boolean> {
      if (this.isLoaded()) return true;
      if (loadingPromise) return loadingPromise;
      loadingPromise = fetchBundle().finally(() => {
        loadingPromise = null;
      });
      return loadingPromise;
    },
    setBundle(data: Record<string, string>): void {
      bundle = data;
    },
  };
}
