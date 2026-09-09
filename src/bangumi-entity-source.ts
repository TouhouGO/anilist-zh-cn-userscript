import rawTitles from '../data/titles_zh_cn.json';
import { normalizeEntityNativeName, toMainlandChinese } from './chinese-normalizer';
import type { EntityKind, EntityNameMap, EntityRef } from './entity-name-types';
import { requestJson, type JsonRequester } from './json-request';

type AniListEntity = { id?: number; name?: { native?: string | null } };
type AniListPayload = { data?: { Page?: { characters?: AniListEntity[]; staff?: AniListEntity[] } } };
type BangumiPerson = { id?: number; name?: string };
type BangumiCharacter = BangumiPerson & { actors?: BangumiPerson[] };
type BangumiDetail = { infobox?: Array<{ key?: string; value?: unknown }> };
type Candidate = { id: number; name: string; actors?: BangumiPerson[] };

export type EntityMediaContext = { mediaId: number; mediaType: 'ANIME' | 'MANGA' };

export type BangumiEntitySource = {
  load(
    context: EntityMediaContext,
    kind: EntityKind,
    ids: number[],
    refs?: EntityRef[],
    actorResolver?: (staffId: number) => string | undefined
  ): Promise<EntityNameMap>;
};

const mediaToSubject = new Map<number, number>();
for (const [k, v] of Object.entries(rawTitles as Record<string, string>)) {
  const id = Number(k);
  if (Number.isInteger(id)) {
    const pipe = v.indexOf('|');
    if (pipe >= 0) {
      const bgmId = Number(v.slice(pipe + 1));
      if (Number.isInteger(bgmId)) mediaToSubject.set(id, bgmId);
    }
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function loadNativeNames(requester: JsonRequester, kind: EntityKind, ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  try {
    const field = kind === 'character' ? 'characters' : 'staff';
    const query = `query ($ids: [Int]) { Page(page: 1, perPage: 50) {
  ${field}(id_in: $ids) { id name { native } }
} }`;
    const payload = (await requester('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { ids } }),
    })) as AniListPayload;
    const entities = payload.data?.Page?.[field] || [];
    const result = new Map<number, string>();
    for (const entity of entities) {
      if (Number.isInteger(entity.id) && entity.name?.native?.trim()) result.set(entity.id!, entity.name.native.trim());
    }
    return result;
  } catch {
    return new Map();
  }
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

function normalizeSimple(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, '');
}

export function createBangumiEntitySource(requester: JsonRequester = requestJson): BangumiEntitySource {
  const charactersCache = new Map<number, Promise<BangumiCharacter[]>>();
  const personsCache = new Map<number, Promise<BangumiPerson[]>>();
  const detailCache = new Map<string, Promise<string | undefined>>();

  function fetchSubjectCharacters(subjectId: number): Promise<BangumiCharacter[]> {
    let p = charactersCache.get(subjectId);
    if (!p) {
      p = requester(`https://api.bgm.tv/v0/subjects/${subjectId}/characters`)
        .then(data => collectCharacters(data))
        .catch(() => []);
      charactersCache.set(subjectId, p);
    }
    return p;
  }

  function fetchSubjectPersons(subjectId: number): Promise<BangumiPerson[]> {
    let p = personsCache.get(subjectId);
    if (!p) {
      p = requester(`https://api.bgm.tv/v0/subjects/${subjectId}/persons`)
        .then(data => asArray<BangumiPerson>(data))
        .catch(() => []);
      personsCache.set(subjectId, p);
    }
    return p;
  }

  function fetchEntityDetailName(path: 'characters' | 'persons', id: number): Promise<string | undefined> {
    const key = `${path}:${id}`;
    let p = detailCache.get(key);
    if (!p) {
      p = requester(`https://api.bgm.tv/v0/${path}/${id}`)
        .then(data => extractSimplifiedName(data))
        .catch(() => undefined);
      detailCache.set(key, p);
    }
    return p;
  }

  return {
    async load(context, kind, ids, refs, actorResolver) {
      const subjectId = mediaToSubject.get(context.mediaId);
      if (!subjectId) return new Map();

      const uniqueIds = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
      if (!uniqueIds.length) return new Map();

      const normalizedRefs: EntityRef[] = refs && refs.length > 0
        ? refs.filter(r => uniqueIds.includes(r.id))
        : uniqueIds.map(id => ({ kind, id }));

      // Collect known native names from refs or AniList GraphQL
      const nativeNames = new Map<number, string>();
      const missingIds: number[] = [];
      for (const ref of normalizedRefs) {
        if (ref.currentName && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ref.currentName)) {
          nativeNames.set(ref.id, ref.currentName.trim());
        } else {
          missingIds.push(ref.id);
        }
      }

      if (missingIds.length > 0) {
        const loaded = await loadNativeNames(requester, kind, missingIds);
        for (const [id, name] of loaded) nativeNames.set(id, name);
      }

      let candidates: Candidate[];
      let rawCharacters: BangumiCharacter[] = [];
      if (kind === 'character') {
        rawCharacters = await fetchSubjectCharacters(subjectId);
        candidates = rawCharacters.map(c => ({ id: c.id!, name: c.name!.trim(), actors: c.actors }));
      } else {
        const [peoplePayload, charactersPayload] = await Promise.all([
          fetchSubjectPersons(subjectId),
          fetchSubjectCharacters(subjectId),
        ]);
        rawCharacters = charactersPayload;
        const actors = charactersPayload.flatMap(character => collectPeople(character.actors));
        candidates = [...collectPeople(peoplePayload), ...actors];
      }

      const byNativeName = candidateIndex(candidates);
      const matches: Array<{ anilistId: number; bangumiId: number; bgmName: string }> = [];
      const matchedIds = new Set<number>();

      // 1. First pass: Match by Actor (for characters)
      if (kind === 'character' && actorResolver) {
        for (const ref of normalizedRefs) {
          if (matchedIds.has(ref.id) || (!ref.actorStaffId && !ref.actorName)) continue;
          const actorZh = ref.actorStaffId ? actorResolver(ref.actorStaffId) : undefined;
          const actorQuery = normalizeSimple(actorZh || ref.actorName || '');
          if (!actorQuery) continue;

          for (const bgmChar of rawCharacters) {
            if (!bgmChar.id || !bgmChar.name) continue;
            const hasActorMatch = bgmChar.actors?.some(a => {
              if (!a.name) return false;
              const aName = normalizeSimple(toMainlandChinese(a.name));
              if (aName === actorQuery || actorQuery.includes(aName) || aName.includes(actorQuery)) return true;
              if (aName.length >= 2 && actorQuery.length >= 2 && aName.slice(0, 2) === actorQuery.slice(0, 2)) return true;
              return false;
            });
            if (hasActorMatch) {
              matches.push({ anilistId: ref.id, bangumiId: bgmChar.id, bgmName: bgmChar.name });
              matchedIds.add(ref.id);
              break;
            }
          }
        }
      }

      // 2. Second pass: Match by Native Name
      for (const ref of normalizedRefs) {
        if (matchedIds.has(ref.id)) continue;
        const nativeName = nativeNames.get(ref.id);
        if (!nativeName) continue;
        const found = byNativeName.get(normalizeEntityNativeName(nativeName)) || [];
        if (found.length === 1) {
          matches.push({ anilistId: ref.id, bangumiId: found[0].id, bgmName: found[0].name });
          matchedIds.add(ref.id);
        }
      }

      // 3. Third pass: Match by English/Normalized Name
      for (const ref of normalizedRefs) {
        if (matchedIds.has(ref.id) || !ref.currentName) continue;
        const refNorm = normalizeSimple(ref.currentName);
        if (!refNorm) continue;
        const found = candidates.filter(c => normalizeSimple(c.name) === refNorm);
        if (found.length === 1) {
          matches.push({ anilistId: ref.id, bangumiId: found[0].id, bgmName: found[0].name });
          matchedIds.add(ref.id);
        }
      }

      // 4. Resolve Chinese translation for matched entities
      const path = kind === 'character' ? 'characters' : 'persons';
      const entries = await mapLimit(matches, 2, async match => {
        try {
          const detailName = await fetchEntityDetailName(path, match.bangumiId);
          if (detailName) return [match.anilistId, detailName] as const;

          const directZh = toMainlandChinese(match.bgmName);
          if (/[\p{Script=Han}]/u.test(directZh) && directZh !== match.bgmName) {
            return [match.anilistId, directZh] as const;
          }

          return undefined;
        } catch {
          return undefined;
        }
      });

      return new Map(entries.filter((entry): entry is readonly [number, string] => Boolean(entry)));
    },
  };
}
