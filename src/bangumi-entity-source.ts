import supplement from '../data/title-supplement.json';
import { normalizeEntityNativeName, toMainlandChinese } from './chinese-normalizer';
import type { EntityKind, EntityNameMap } from './entity-name-types';
import { requestJson, type JsonRequester } from './json-request';

type SupplementEntry = { id: number; bangumiId?: number };
type AniListEntity = { id?: number; name?: { native?: string | null } };
type AniListPayload = { data?: { Page?: { characters?: AniListEntity[]; staff?: AniListEntity[] } } };
type BangumiPerson = { id?: number; name?: string };
type BangumiCharacter = BangumiPerson & { actors?: BangumiPerson[] };
type BangumiDetail = { infobox?: Array<{ key?: string; value?: unknown }> };
type Candidate = { id: number; name: string };

export type EntityMediaContext = { mediaId: number; mediaType: 'ANIME' | 'MANGA' };

export type BangumiEntitySource = {
  load(context: EntityMediaContext, kind: EntityKind, ids: number[]): Promise<EntityNameMap>;
};

const mediaToSubject = new Map<number, number>();
for (const entry of supplement.entries as SupplementEntry[]) {
  if (Number.isInteger(entry.bangumiId)) mediaToSubject.set(entry.id, entry.bangumiId!);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

async function loadNativeNames(requester: JsonRequester, kind: EntityKind, ids: number[]): Promise<Map<number, string>> {
  const field = kind === 'character' ? 'characters' : 'staff';
  const query = `query ($ids: [Int]) { Page(page: 1, perPage: 50) {
  ${field}(id_in: $ids) { id name { native } }
} }`;
  const payload = await requester('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables: { ids } }),
  }) as AniListPayload;
  const entities = payload.data?.Page?.[field] || [];
  const result = new Map<number, string>();
  for (const entity of entities) {
    if (Number.isInteger(entity.id) && entity.name?.native?.trim()) result.set(entity.id!, entity.name.native.trim());
  }
  return result;
}

function uniqueCandidates(items: Candidate[]): Candidate[] {
  return [...new Map(items.map(item => [item.id, item])).values()];
}

function candidateIndex(items: Candidate[]): Map<string, Candidate[]> {
  const index = new Map<string, Candidate[]>();
  for (const item of uniqueCandidates(items)) {
    const key = normalizeEntityNativeName(item.name);
    if (!key) continue;
    const existing = index.get(key) || [];
    existing.push(item);
    index.set(key, existing);
  }
  return index;
}

function collectPeople(value: unknown): Candidate[] {
  return asArray<BangumiPerson>(value)
    .filter(item => Number.isInteger(item.id) && Boolean(item.name?.trim()))
    .map(item => ({ id: item.id!, name: item.name!.trim() }));
}

function collectCharacters(value: unknown): BangumiCharacter[] {
  return asArray<BangumiCharacter>(value);
}

function extractSimplifiedName(value: unknown): string | undefined {
  const detail = value as BangumiDetail;
  const raw = detail.infobox?.find(item => item.key?.trim() === '简体中文名')?.value;
  if (typeof raw !== 'string') return undefined;
  const name = toMainlandChinese(raw.trim());
  return /[\p{Script=Han}]/u.test(name) ? name : undefined;
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function createBangumiEntitySource(requester: JsonRequester = requestJson): BangumiEntitySource {
  return {
    async load(context, kind, ids) {
      const subjectId = mediaToSubject.get(context.mediaId);
      const uniqueIds = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
      if (!subjectId || !uniqueIds.length) return new Map();

      const nativeNames = await loadNativeNames(requester, kind, uniqueIds);
      let candidates: Candidate[];
      if (kind === 'character') {
        const characters = collectCharacters(await requester(`https://api.bgm.tv/v0/subjects/${subjectId}/characters`));
        candidates = collectPeople(characters);
      } else {
        const [peoplePayload, charactersPayload] = await Promise.all([
          requester(`https://api.bgm.tv/v0/subjects/${subjectId}/persons`),
          requester(`https://api.bgm.tv/v0/subjects/${subjectId}/characters`),
        ]);
        const actors = collectCharacters(charactersPayload).flatMap(character => collectPeople(character.actors));
        candidates = [...collectPeople(peoplePayload), ...actors];
      }

      const byNativeName = candidateIndex(candidates);
      const matches: Array<{ anilistId: number; bangumiId: number }> = [];
      for (const [anilistId, nativeName] of nativeNames) {
        const found = byNativeName.get(normalizeEntityNativeName(nativeName)) || [];
        if (found.length === 1) matches.push({ anilistId, bangumiId: found[0].id });
      }

      const entries = await mapLimit(matches, 2, async match => {
        try {
          const path = kind === 'character' ? 'characters' : 'persons';
          const detail = await requester(`https://api.bgm.tv/v0/${path}/${match.bangumiId}`);
          const name = extractSimplifiedName(detail);
          return name ? [match.anilistId, name] as const : undefined;
        } catch { return undefined; }
      });

      return new Map(entries.filter((entry): entry is readonly [number, string] => Boolean(entry)));
    },
  };
}
