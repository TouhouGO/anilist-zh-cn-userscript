import { bangumiTagZhCN } from './data/tag-bangumi-zh-CN';
import { tagZhCN } from './data/tag-zh-CN';
import supplement from '../data/title-supplement.json';
type SubjectEntry = { id: number; bangumiId?: number };
type SubjectPayload = { tags?: Array<{ name?: string }> };
type RequestLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
declare const GM_xmlhttpRequest: ((details: { url: string; method: string; onload: (response: { status: number; responseText: string }) => void; onerror: () => void }) => void) | undefined;
const reverseMap = new Map<string, string>();
for (const [anilist, chinese] of Object.entries({ ...tagZhCN, ...bangumiTagZhCN })) reverseMap.set(chinese, anilist);
export type BangumiTagService = { loadForAniList(id: number): Promise<Record<string, string>> };
export function createBangumiTagService(fetcher: RequestLike = fetch): BangumiTagService {
  const entries = new Map<number, number>();
  for (const item of (supplement.entries as SubjectEntry[])) if (item.bangumiId) entries.set(item.id, item.bangumiId);
  const cache = new Map<number, Record<string, string>>();
  return { async loadForAniList(id) {
    const subjectId = entries.get(id); if (!subjectId) return {};
    const cached = cache.get(subjectId); if (cached) return cached;
    try {
      const response = await requestSubject(subjectId, fetcher); if (!response.ok) return {};
      const payload = await response.json() as SubjectPayload; const result: Record<string, string> = {};
      for (const tag of payload.tags || []) { const chinese = tag.name?.trim(); const anilist = chinese ? reverseMap.get(chinese) : undefined; if (anilist && chinese) result[anilist] = chinese; }
      cache.set(subjectId, result); return result;
    } catch { return {}; }
  } };
}

function requestSubject(subjectId: number, fetcher: RequestLike): Promise<{ ok: boolean; json(): Promise<unknown> }> {
  if (typeof GM_xmlhttpRequest === 'function') return new Promise(resolve => GM_xmlhttpRequest({ url: `https://api.bgm.tv/v0/subjects/${subjectId}`, method: 'GET', onload: response => resolve({ ok: response.status >= 200 && response.status < 300, json: async () => JSON.parse(response.responseText) }), onerror: () => resolve({ ok: false, json: async () => ({}) }) }));
  return fetcher(`https://api.bgm.tv/v0/subjects/${subjectId}`);
}
