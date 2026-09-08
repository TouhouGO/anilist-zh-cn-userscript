import { toMainlandChinese } from './chinese-normalizer';
import { requestJson, type JsonRequester } from './json-request';
import type { TitleService } from './title-service';
import { getSafeStorage, type StorageLike } from './types';

export type BangumiDescriptionInfo = {
  summary?: string;
  nameCn?: string;
  bangumiId?: number;
};

export type DescriptionQueryOptions = {
  isAnime?: boolean;
  nativeTitle?: string;
  releaseYear?: number;
};

export type BangumiDescriptionService = {
  getDescription(mediaId: number, options?: DescriptionQueryOptions): Promise<BangumiDescriptionInfo>;
};

const STORAGE_PREFIX = 'anilist-zh-cn-bgm-desc-';
const CACHE_TTL_FOUND = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_TTL_EMPTY = 7 * 24 * 60 * 60 * 1000; // 7 days

function normalizeSearchTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}〜～・·:：!！?？\-]+/gu, '')
    .trim();
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatBangumiSummary(raw: string): string {
  return toMainlandChinese(raw)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

type BangumiSearchItem = {
  id?: number;
  type?: number | string;
  name?: string;
  name_cn?: string;
  air_date?: string;
};

type BangumiSearchPayload = {
  list?: BangumiSearchItem[];
};

type BangumiSubjectPayload = {
  id?: number;
  name?: string;
  name_cn?: string;
  summary?: string;
};

export async function searchBangumiSubjectStrict(
  keyword: string,
  isAnime: boolean,
  releaseYear: number | undefined,
  requester: JsonRequester
): Promise<number | undefined> {
  const normQuery = normalizeSearchTitle(keyword);
  if (!normQuery) return undefined;

  const targetType = isAnime ? 2 : 1;
  const url = `https://api.bgm.tv/search/subject/${encodeURIComponent(keyword.trim())}?type=${targetType}`;
  try {
    const payload = (await requester(url, {
      headers: {
        'User-Agent': 'TouhouGO/anilist-zh-cn-userscript (https://github.com/TouhouGO)',
        Accept: 'application/json',
      },
    })) as BangumiSearchPayload;

    const list = Array.isArray(payload?.list) ? payload.list : [];
    const matches: number[] = [];

    for (const item of list) {
      const candType = Number(item.type);
      if (candType !== targetType) continue;

      const name = item.name || '';
      const nameCn = item.name_cn || '';
      const normName = normalizeSearchTitle(name);
      const normNameCn = normalizeSearchTitle(nameCn);

      const nameMatches = (normName && normName === normQuery) || (normNameCn && normNameCn === normQuery);
      if (!nameMatches) continue;

      if (releaseYear && item.air_date) {
        const candYear = parseInt(item.air_date.slice(0, 4), 10);
        if (Number.isInteger(candYear) && candYear !== releaseYear) continue;
      }

      if (Number.isInteger(item.id)) matches.push(item.id!);
    }

    return matches.length === 1 ? matches[0] : undefined;
  } catch {
    return undefined;
  }
}

export function createBangumiDescriptionService(
  titleService: TitleService,
  requester: JsonRequester = requestJson,
  storage: StorageLike = getSafeStorage()
): BangumiDescriptionService {
  const memoryCache = new Map<number, BangumiDescriptionInfo>();

  function loadCached(mediaId: number): BangumiDescriptionInfo | undefined {
    const inMem = memoryCache.get(mediaId);
    if (inMem) return inMem;

    try {
      const raw = storage.getItem(STORAGE_PREFIX + mediaId);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && typeof parsed.time === 'number') {
        const ttl = parsed.summary ? CACHE_TTL_FOUND : CACHE_TTL_EMPTY;
        if (Date.now() - parsed.time < ttl) {
          const info: BangumiDescriptionInfo = {
            summary: parsed.summary || undefined,
            nameCn: parsed.nameCn || undefined,
            bangumiId: parsed.bangumiId || undefined,
          };
          memoryCache.set(mediaId, info);
          return info;
        }
      }
    } catch {
      /* ignore invalid cache */
    }
    return undefined;
  }

  function saveCache(mediaId: number, info: BangumiDescriptionInfo) {
    memoryCache.set(mediaId, info);
    try {
      storage.setItem(
        STORAGE_PREFIX + mediaId,
        JSON.stringify({
          time: Date.now(),
          summary: info.summary,
          nameCn: info.nameCn,
          bangumiId: info.bangumiId,
        })
      );
    } catch {
      /* ignore storage quota errors */
    }
  }

  return {
    async getDescription(mediaId, options = {}) {
      if (!Number.isInteger(mediaId) || mediaId <= 0) return {};

      const cached = loadCached(mediaId);
      if (cached) return cached;

      let targetBgmId = titleService.getBangumiId(mediaId);

      if (!targetBgmId && options.nativeTitle) {
        targetBgmId = await searchBangumiSubjectStrict(
          options.nativeTitle,
          options.isAnime ?? true,
          options.releaseYear,
          requester
        );
      }

      if (!targetBgmId) {
        const emptyResult: BangumiDescriptionInfo = {};
        saveCache(mediaId, emptyResult);
        return emptyResult;
      }

      try {
        const url = `https://api.bgm.tv/v0/subjects/${targetBgmId}`;
        const payload = (await requester(url, {
          headers: {
            'User-Agent': 'TouhouGO/anilist-zh-cn-userscript (https://github.com/TouhouGO)',
            Accept: 'application/json',
          },
        })) as BangumiSubjectPayload;

        const rawSummary = payload?.summary?.trim();
        const rawNameCn = payload?.name_cn?.trim();

        const formattedSummary = rawSummary ? formatBangumiSummary(rawSummary) : undefined;
        const nameCn = rawNameCn ? toMainlandChinese(rawNameCn) : undefined;

        const result: BangumiDescriptionInfo = {
          summary: formattedSummary,
          nameCn,
          bangumiId: targetBgmId,
        };

        saveCache(mediaId, result);
        return result;
      } catch {
        const errorResult: BangumiDescriptionInfo = { bangumiId: targetBgmId };
        return errorResult;
      }
    },
  };
}
