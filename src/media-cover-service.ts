import type { FetchLike } from './types';

export type MediaCoverService = { load(ids: number[]): Promise<Map<number, string>> };
const URL = 'https://graphql.anilist.co';
const QUERY = 'query($ids:[Int]){Page(perPage:50){media(id_in:$ids){id coverImage{medium}}}}';

export function createMediaCoverService(fetcher: FetchLike = fetch): MediaCoverService {
  const covers = new Map<number, string>();
  const known = new Set<number>();
  return {
    async load(ids) {
      const unique = [...new Set(ids.filter(Number.isInteger))];
      const missing = unique.filter(id => !known.has(id));
      if (missing.length) {
        const response = await fetcher(URL, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ query: QUERY, variables: { ids: missing } }),
        });
        if (!response.ok) throw new Error(`cover data: ${response.status}`);
        const payload = await response.json() as { data?: { Page?: { media?: Array<{ id: number; coverImage?: { medium?: string | null } }> } } };
        for (const id of missing) known.add(id);
        for (const item of payload.data?.Page?.media || []) if (item.coverImage?.medium) covers.set(item.id, item.coverImage.medium);
      }
      return new Map(unique.flatMap(id => covers.has(id) ? [[id, covers.get(id)!] as const] : []));
    },
  };
}
