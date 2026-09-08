import { titleOverrides } from './data/title-overrides';
import { toMainlandChinese } from './chinese-normalizer';
import rawTitles from '../data/titles_zh_cn.json';
import { getSafeStorage, type FetchLike, type StorageLike } from './types';

export type TitleMatch = { id: number; title: string; native?: string; type?: 'anime' | 'manga' };
const URL = 'https://raw.githubusercontent.com/TouhouGO/anilist-zh-cn-userscript/main/data/titles_zh_cn.json';
const KEY = 'anilist-zh-cn-title-cache-v3';

function normalizeSearch(value: string): string {
  return toMainlandChinese(value).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function parseEntryValue(value: string): { title: string; bangumiId?: number } {
  const pipe = value.indexOf('|');
  if (pipe >= 0) {
    const title = value.slice(0, pipe).trim();
    const bgmId = Number(value.slice(pipe + 1));
    return { title, bangumiId: Number.isInteger(bgmId) ? bgmId : undefined };
  }
  return { title: value.trim() };
}

export function createTitleService(storage: StorageLike = getSafeStorage(), fetcher: FetchLike = fetch): TitleService {
  const entries = new Map<number, string>();
  const bangumiIds = new Map<number, number>();
  const nativeFallback = new Map<string, string>();
  const nativeByTitle = new Map<string, string>();
  const searchable = new Map<number, TitleMatch>();

  for (const [k, v] of Object.entries(rawTitles as Record<string, string>)) {
    const id = Number(k);
    const parsed = parseEntryValue(v);
    const chinese = toMainlandChinese(parsed.title);
    if (Number.isInteger(id)) {
      entries.set(id, chinese);
      if (parsed.bangumiId) bangumiIds.set(id, parsed.bangumiId);
      searchable.set(id, {
        id,
        title: titleOverrides[id] || chinese,
      });
    } else if (k && chinese) {
      nativeFallback.set(k, chinese);
      nativeByTitle.set(chinese, k);
    }
  }

  for (const item of searchable.values()) {
    const native = nativeByTitle.get(item.title);
    if (native) item.native = native;
  }

  try {
    const cached = JSON.parse(storage.getItem(KEY) || 'null');
    if (cached && typeof cached === 'object' && cached.delta) {
      for (const [idStr, title] of Object.entries(cached.delta as Record<string, string>)) {
        const id = Number(idStr);
        if (Number.isInteger(id) && !entries.has(id)) {
          const chinese = toMainlandChinese(title);
          entries.set(id, chinese);
          searchable.set(id, { id, title: titleOverrides[id] || chinese });
        }
      }
    } else if (cached?.entries && Array.isArray(cached.entries)) {
      for (const [id, title] of cached.entries) {
        const numId = Number(id);
        if (Number.isInteger(numId) && !entries.has(numId)) {
          const chinese = toMainlandChinese(title);
          entries.set(numId, chinese);
          searchable.set(numId, { id: numId, title: titleOverrides[numId] || chinese });
        }
      }
    }
  } catch {
    /* ignore malformed local cache */
  }

  return {
    getTitle(id, fallback) {
      return titleOverrides[id] || entries.get(id) || nativeFallback.get(fallback) || fallback;
    },
    getBangumiId(id) {
      return bangumiIds.get(id);
    },
    searchTitles(query, limit = 12) {
      const normalized = normalizeSearch(query);
      if (normalized.length < 2 || !/[\p{Script=Han}]/u.test(normalized)) return [];
      return [...searchable.values()]
        .map(item => ({ item, normalizedTitle: normalizeSearch(item.title) }))
        .filter(({ normalizedTitle }) => normalizedTitle.includes(normalized))
        .sort((a, b) =>
          Number(a.normalizedTitle !== normalized) - Number(b.normalizedTitle !== normalized)
          || Number(!a.normalizedTitle.startsWith(normalized)) - Number(!b.normalizedTitle.startsWith(normalized))
          || a.normalizedTitle.length - b.normalizedTitle.length
          || a.item.id - b.item.id
        )
        .slice(0, limit)
        .map(({ item }) => item);
    },
    async refresh() {
      const response = await fetcher(URL);
      if (!response.ok) throw new Error(`title data: ${response.status}`);
      const payload = await response.json();
      const delta: Record<string, string> = {};

      if (Array.isArray(payload)) {
        for (const item of payload) {
          if (item && Number.isInteger(item.id) && item.title && !entries.has(item.id)) {
            const title = toMainlandChinese(item.title);
            entries.set(item.id, title);
            searchable.set(item.id, { id: item.id, title: titleOverrides[item.id] || title, native: item.native });
            delta[item.id] = title;
          }
        }
      } else if (payload && typeof payload === 'object') {
        for (const [k, v] of Object.entries(payload as Record<string, string>)) {
          const id = Number(k);
          if (Number.isInteger(id)) {
            if (!entries.has(id)) {
              const { title, bangumiId } = parseEntryValue(v);
              const chinese = toMainlandChinese(title);
              entries.set(id, chinese);
              if (bangumiId) bangumiIds.set(id, bangumiId);
              searchable.set(id, { id, title: titleOverrides[id] || chinese });
              delta[id] = chinese;
            }
          } else if (k && !nativeFallback.has(k)) {
            const { title } = parseEntryValue(v);
            const chinese = toMainlandChinese(title);
            nativeFallback.set(k, chinese);
          }
        }
      }

      storage.setItem(KEY, JSON.stringify({ time: Date.now(), delta }));
    },
  };
}

export type TitleService = {
  getTitle(id: number, fallback: string): string;
  getBangumiId(id: number): number | undefined;
  searchTitles(query: string, limit?: number): TitleMatch[];
  refresh(): Promise<void>;
};
