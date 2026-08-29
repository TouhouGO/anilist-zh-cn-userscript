import { titleOverrides } from './data/title-overrides';
import { toMainlandChinese } from './chinese-normalizer';
import supplement from '../data/title-supplement.json';
import type { FetchLike, StorageLike } from './types';

type Entry = { id: number; title: string; native?: string; synonyms?: string[] };
export type TitleMatch = { id: number; title: string; native?: string; type?: 'anime' | 'manga' };
const URL = 'https://raw.githubusercontent.com/soruly/anilist-chinese/master/anilist-chinese.json';
const KEY = 'anilist-zh-cn-title-cache-v2';
function normalizeSearch(value: string): string { return toMainlandChinese(value).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ''); }
export function createTitleService(storage: StorageLike = localStorage, fetcher: FetchLike = fetch): TitleService {
  let entries = new Map<number, string>(supplement.entries.map(item => [item.id, toMainlandChinese(item.title)]));
  const searchable = new Map<number, TitleMatch>(supplement.entries.map(item => [item.id, { id: item.id, title: titleOverrides[item.id] || toMainlandChinese(item.title), native: item.native || undefined }]));
  try { const cached = JSON.parse(storage.getItem(KEY) || 'null'); if (cached && Date.now() - cached.time < 86400000) for (const [id, title] of cached.entries) if (!entries.has(Number(id))) { const numericId = Number(id); const chinese = toMainlandChinese(title); entries.set(numericId, chinese); searchable.set(numericId, { id: numericId, title: titleOverrides[numericId] || chinese }); } } catch { /* ignore malformed cache */ }
  return {
    getTitle(id, fallback) { return titleOverrides[id] || entries.get(id) || fallback; },
    searchTitles(query, limit = 12) {
      const normalized = normalizeSearch(query);
      if (normalized.length < 2 || !/[\p{Script=Han}]/u.test(normalized)) return [];
      return [...searchable.values()]
        .map(item => ({ item, normalizedTitle: normalizeSearch(item.title) }))
        .filter(({ normalizedTitle }) => normalizedTitle.includes(normalized))
        .sort((a, b) => Number(a.normalizedTitle !== normalized) - Number(b.normalizedTitle !== normalized)
          || Number(!a.normalizedTitle.startsWith(normalized)) - Number(!b.normalizedTitle.startsWith(normalized))
          || a.normalizedTitle.length - b.normalizedTitle.length
          || a.item.id - b.item.id)
        .slice(0, limit)
        .map(({ item }) => item);
    },
    async refresh() { const response = await fetcher(URL); if (!response.ok) throw new Error(`title data: ${response.status}`); const payload = await response.json() as Entry[]; let added = 0; for (const item of payload) if (Number.isInteger(item.id) && item.title && !entries.has(item.id)) { const title = toMainlandChinese(item.title); entries.set(item.id, title); searchable.set(item.id, { id: item.id, title: titleOverrides[item.id] || title, native: item.native }); added++; } storage.setItem(KEY, JSON.stringify({ time: Date.now(), entries: [...entries] })); void added; },
  };
}
export type TitleService = { getTitle(id: number, fallback: string): string; searchTitles(query: string, limit?: number): TitleMatch[]; refresh(): Promise<void> };
